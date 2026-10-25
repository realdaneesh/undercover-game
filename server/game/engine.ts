import { randomInt } from 'node:crypto';
import type {
  Clue,
  Phase,
  PrivatePlayer,
  PublicPlayer,
  PublicRoom,
  Settings,
  VoteResult,
} from '../../shared/types.js';
import { WORDS } from '../data/words.js';
import { cleanText, normalizeGuess, requireThat, shuffle } from '../utils/validation.js';

export interface Player extends PublicPlayer {
  token: string;
  socketId?: string;
  disconnectedAt?: number;
}
export interface Durations {
  reveal: number;
  discussion: number;
  voting: number;
  results: number;
  guess: number;
}
const DURATIONS: Durations = {
  reveal: 25000,
  discussion: 120000,
  voting: 30000,
  results: 6500,
  guess: 30000,
};
export class Game {
  phase: Phase = 'LOBBY';
  players = new Map<string, Player>();
  hostId: string;
  word = '';
  imposterId = '';
  round = 0;
  gameId = 0;
  order: string[] = [];
  turn = 0;
  clues: Clue[] = [];
  votes = new Map<string, string>();
  candidates: string[] = [];
  revote = false;
  deadline: number | null = null;
  result?: VoteResult;
  winner?: 'agents' | 'imposter';
  reason?: string;
  private next: 'revote' | 'clues' | 'guess' = 'clues';
  constructor(
    public code: string,
    host: Player,
    public settings: Settings,
    private durations: Durations = DURATIONS,
  ) {
    this.hostId = host.id;
    this.players.set(host.id, host);
  }
  active(): Player[] {
    return [...this.players.values()].filter((p) => p.active);
  }
  host(id: string): void {
    requireThat(id === this.hostId, 'Only the host can do that.');
  }
  inPhase(...phases: Phase[]): void {
    requireThat(phases.includes(this.phase), 'That action is not available in this phase.');
  }
  player(id: string): Player {
    const p = this.players.get(id);
    requireThat(p, 'Your player session has ended.');
    return p;
  }
  start(id: string, now: number): void {
    this.host(id);
    this.inPhase('LOBBY');
    const players = [...this.players.values()];
    requireThat(players.length >= 3 && players.length <= 12, 'You need 3–12 players to start.');
    requireThat(
      players.every((p) => p.connected),
      'Wait for everyone to reconnect, or remove offline players.',
    );
    players.forEach((p) => {
      p.active = true;
      p.ready = false;
    });
    const words =
      this.settings.category === 'All categories'
        ? Object.values(WORDS).flat()
        : WORDS[this.settings.category];
    this.word = words[randomInt(words.length)];
    this.order = shuffle(players.map((p) => p.id));
    this.imposterId = this.order[0];
    // Turn order is independent of role assignment.
    this.order = shuffle(this.order);
    this.round = 0;
    this.gameId++;
    this.clues = [];
    this.votes.clear();
    this.result = undefined;
    this.winner = undefined;
    this.reason = undefined;
    this.revote = false;
    this.candidates = [];
    this.phase = 'ROLE_REVEAL';
    this.deadline = now + this.durations.reveal;
  }
  ready(id: string, now: number): void {
    this.inPhase('ROLE_REVEAL');
    this.player(id).ready = true;
    if (this.active().every((p) => p.ready)) this.beginClues(now);
  }
  private beginClues(now: number): void {
    this.phase = 'CLUE_ROUND';
    this.round++;
    this.turn = 0;
    this.revote = false;
    this.result = undefined;
    this.votes.clear();
    this.candidates = [];
    this.order = this.order.filter((id) => this.players.get(id)?.active);
    if (this.round > 1) this.order.push(this.order.shift()!);
    this.deadline = now + this.settings.clueSeconds * 1000;
  }
  clue(id: string, input: string, now: number): void {
    // Repeated packets with the same payload have no effect, even after the turn moved.
    const text = cleanText(input, 1, 48, 'Clue');
    const prior = this.clues.find((c) => c.round === this.round && c.playerId === id);
    if (prior) {
      requireThat(prior.text === text, 'Your clue is already locked in.');
      return;
    }
    this.inPhase('CLUE_ROUND');
    requireThat(this.order[this.turn] === id && this.player(id).active, 'Wait for your turn.');
    requireThat(
      normalizeGuess(text) !== normalizeGuess(this.word),
      'Give a clue without using the secret word.',
    );
    this.clues.push({ playerId: id, round: this.round, text, skipped: false });
    this.advanceTurn(now);
  }
  private advanceTurn(now: number): void {
    this.turn++;
    while (this.turn < this.order.length && !this.players.get(this.order[this.turn])?.active)
      this.turn++;
    if (this.turn >= this.order.length) {
      this.phase = 'DISCUSSION';
      this.deadline = now + this.durations.discussion;
    } else this.deadline = now + this.settings.clueSeconds * 1000;
  }
  discussed(id: string, now: number): void {
    this.host(id);
    this.inPhase('DISCUSSION');
    this.beginVoting(now, false);
  }
  private beginVoting(now: number, revote: boolean): void {
    this.phase = 'VOTING';
    this.revote = revote;
    this.votes.clear();
    this.candidates = revote
      ? this.result!.tied.filter((id) => this.players.get(id)?.active)
      : this.active().map((p) => p.id);
    this.deadline = now + this.durations.voting;
  }
  vote(id: string, target: string, now: number): void {
    const prior = this.votes.get(id);
    if (prior) {
      requireThat(prior === target, 'Your vote is already locked in.');
      return;
    }
    this.inPhase('VOTING');
    requireThat(this.player(id).active, 'Eliminated players can spectate but cannot vote.');
    requireThat(
      target !== id && this.candidates.includes(target) && this.player(target).active,
      'Choose another eligible player.',
    );
    this.votes.set(id, target);
    if (this.active().every((p) => this.votes.has(p.id))) this.tally(now);
  }
  private tally(now: number): void {
    const counts: Record<string, number> = Object.fromEntries(
      this.candidates.filter((id) => this.players.get(id)?.active).map((id) => [id, 0]),
    );
    for (const [voter, target] of this.votes)
      if (this.players.get(voter)?.active && target in counts) counts[target]++;
    const max = Math.max(0, ...Object.values(counts));
    const tied = Object.keys(counts).filter((id) => counts[id] === max);
    this.result = { counts, tied: tied.length > 1 ? tied : [], revote: this.revote };
    if (max > 0 && tied.length === 1) {
      const id = tied[0];
      this.player(id).active = false;
      this.result.eliminatedId = id;
      this.result.wasImposter = id === this.imposterId;
      this.next = id === this.imposterId ? 'guess' : 'clues';
    } else this.next = !this.revote && tied.length > 1 ? 'revote' : 'clues';
    this.phase = 'VOTE_RESULTS';
    this.deadline = now + this.durations.results;
  }
  guess(id: string, input: string): void {
    this.inPhase('FINAL_GUESS');
    requireThat(id === this.imposterId, 'Only the eliminated Imposter can guess.');
    const text = cleanText(input, 1, 48, 'Guess');
    this.finish(
      normalizeGuess(text) === normalizeGuess(this.word) ? 'imposter' : 'agents',
      normalizeGuess(text) === normalizeGuess(this.word)
        ? 'The Imposter cracked the secret word.'
        : 'The Imposter’s final guess missed.',
    );
  }
  private finish(winner: 'agents' | 'imposter', reason: string): void {
    this.winner = winner;
    this.reason = reason;
    this.phase = 'GAME_OVER';
    this.deadline = null;
  }
  again(id: string): void {
    this.host(id);
    this.inPhase('GAME_OVER');
    this.phase = 'LOBBY';
    this.deadline = null;
    this.word = '';
    this.imposterId = '';
    this.clues = [];
    this.votes.clear();
    this.order = [];
    this.round = 0;
    this.result = undefined;
    this.winner = undefined;
    this.reason = undefined;
    this.candidates = [];
    this.revote = false;
    this.players.forEach((p, playerId) => {
      if (!p.token) {
        this.players.delete(playerId);
        return;
      }
      p.active = true;
      p.ready = false;
    });
  }
  depart(id: string, now: number): void {
    const p = this.player(id);
    p.token = '';
    p.active = false;
    p.connected = false;
    p.socketId = undefined;
    if (this.phase === 'LOBBY' || this.phase === 'GAME_OVER') this.players.delete(id);
    else {
      if (id === this.imposterId) this.finish('agents', 'The Imposter left the operation.');
      else if (
        this.phase !== 'FINAL_GUESS' &&
        !(this.phase === 'VOTE_RESULTS' && this.next === 'guess') &&
        this.active().length <= 2
      )
        this.finish('imposter', 'Only two agents remain. The Imposter slipped away.');
      else if (this.phase === 'CLUE_ROUND' && this.order[this.turn] === id) this.advanceTurn(now);
      else if (this.phase === 'ROLE_REVEAL' && this.active().every((p) => p.ready))
        this.beginClues(now);
      else if (this.phase === 'VOTING' && this.active().every((p) => this.votes.has(p.id)))
        this.tally(now);
    }
    if (this.hostId === id)
      this.hostId =
        [...this.players.values()].find((p) => p.connected)?.id ??
        [...this.players.values()].find((p) => p.active)?.id ??
        '';
  }
  tick(now: number): boolean {
    if (this.deadline === null || now < this.deadline) return false;
    switch (this.phase) {
      case 'ROLE_REVEAL':
        this.beginClues(now);
        break;
      case 'CLUE_ROUND': {
        this.clues.push({
          playerId: this.order[this.turn],
          round: this.round,
          text: 'Time ran out',
          skipped: true,
        });
        this.advanceTurn(now);
        break;
      }
      case 'DISCUSSION':
        this.beginVoting(now, false);
        break;
      case 'VOTING':
        this.tally(now);
        break;
      case 'VOTE_RESULTS':
        if (this.next === 'guess') {
          this.phase = 'FINAL_GUESS';
          this.deadline = now + this.durations.guess;
        } else if (this.active().length <= 2)
          this.finish('imposter', 'Only two agents remain. The Imposter slipped away.');
        else if (
          this.next === 'revote' &&
          this.result!.tied.filter((id) => this.players.get(id)?.active).length > 1
        )
          this.beginVoting(now, true);
        else this.beginClues(now);
        break;
      case 'FINAL_GUESS':
        this.finish('agents', 'The Imposter ran out of time to guess.');
        break;
      default:
        return false;
    }
    return true;
  }
  publicState(now: number): PublicRoom {
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      settings: { ...this.settings },
      players: [...this.players.values()].map(({ id, name, color, connected, active, ready }) => ({
        id,
        name,
        color,
        connected,
        active,
        ready,
      })),
      round: this.round,
      gameId: this.gameId,
      order: [...this.order],
      turnId: this.phase === 'CLUE_ROUND' ? this.order[this.turn] : undefined,
      clues: this.clues.map((c) => ({ ...c })),
      deadline: this.deadline,
      serverTime: now,
      voteCount: this.votes.size,
      candidates: [...this.candidates],
      revote: this.revote,
      result:
        this.phase === 'VOTE_RESULTS' || this.phase === 'FINAL_GUESS' || this.phase === 'GAME_OVER'
          ? this.result
          : undefined,
      winner: this.winner,
      reason: this.reason,
      imposterId: this.phase === 'GAME_OVER' ? this.imposterId : undefined,
    };
  }
  privateState(id: string): PrivatePlayer {
    const p = this.player(id);
    const hasRole = this.phase !== 'LOBBY';
    const role = id === this.imposterId ? 'imposter' : 'agent';
    return {
      id,
      ...(hasRole ? { role, ...(role === 'agent' ? { word: this.word } : {}) } : {}),
      voted: this.votes.has(id),
      ready: p.ready,
    };
  }
}
