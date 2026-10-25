import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/types.js';
import { Game, type Player } from '../game/engine.js';
import { RoomManager } from '../rooms/manager.js';
import { WORDS } from '../data/words.js';
import { shuffle, validateSettings } from '../utils/validation.js';

const durations = { reveal: 10, discussion: 10, voting: 10, results: 10, guess: 10 };
function player(id: string): Player {
  return { id, token: id, name: id, color: 0, connected: true, active: true, ready: false };
}
function setup(count = 3) {
  const game = new Game('ABC234', player('p0'), { ...DEFAULT_SETTINGS }, durations);
  for (let i = 1; i < count; i++) game.players.set(`p${i}`, player(`p${i}`));
  game.start('p0', 0);
  return game;
}
function clues(game: Game, now = 10) {
  if (game.phase === 'ROLE_REVEAL') game.tick(now);
  while (game.phase === 'CLUE_ROUND') game.clue(game.order[game.turn], `clue ${game.turn}`, now);
}
function eliminateImposter(game: Game) {
  clues(game);
  game.discussed('p0', 10);
  const other = game.active().find((p) => p.id !== game.imposterId)!.id;
  for (const p of game.active())
    game.vote(p.id, p.id === game.imposterId ? other : game.imposterId, 10);
  game.tick(20);
}

describe('authoritative Classic engine', () => {
  it('assigns exactly one Imposter, equal agent words, and never broadcasts secrets or tokens', () => {
    for (let n = 3; n <= 12; n++) {
      const g = setup(n);
      const states = [...g.players.keys()].map((id) => g.privateState(id));
      expect(states.filter((s) => s.role === 'imposter')).toHaveLength(1);
      expect(states.filter((s) => s.role === 'agent').every((s) => s.word === g.word)).toBe(true);
      expect(g.privateState(g.imposterId)).not.toHaveProperty('word');
      const json = JSON.stringify(g.publicState(0));
      expect(json).not.toContain(g.word);
      expect(json).not.toContain('token');
      expect(json).not.toContain('imposterId');
    }
  });
  it('enforces player count, connected players, and host authorization', () => {
    const g = new Game('ABC234', player('p0'), DEFAULT_SETTINGS);
    expect(() => g.start('p0', 0)).toThrow(/3–12/);
    g.players.set('p1', player('p1'));
    g.players.set('p2', { ...player('p2'), connected: false });
    expect(() => g.start('p1', 0)).toThrow(/host/);
    expect(() => g.start('p0', 0)).toThrow(/reconnect/);
  });
  it('transitions after all ready, enforces turns, sanitizes and locks clues', () => {
    const g = setup();
    const ids = [...g.players.keys()];
    ids.forEach((id) => g.ready(id, 1));
    expect(g.phase).toBe('CLUE_ROUND');
    const first = g.order[0];
    const second = g.order[1];
    expect(() => g.clue(second, 'hello', 1)).toThrow(/turn/);
    g.clue(first, '<bright>\n clue', 1);
    expect(g.clues[0].text).toBe('bright clue');
    g.clue(first, 'bright clue', 1);
    expect(g.clues).toHaveLength(1);
    expect(() => g.clue(first, 'changed', 1)).toThrow(/locked/);
    expect(() => g.clue(second, g.word, 1)).toThrow(/secret word/);
    expect(() => g.clue(second, 'x'.repeat(49), 1)).toThrow(/48/);
  });
  it('uses server deadlines for skipped turns, discussion, voting and final guess', () => {
    const g = setup();
    expect(g.tick(9)).toBe(false);
    g.tick(10);
    while (g.phase === 'CLUE_ROUND') g.tick(g.deadline!);
    expect(g.phase).toBe('DISCUSSION');
    expect(g.clues.every((c) => c.skipped)).toBe(true);
    g.tick(g.deadline!);
    expect(g.phase).toBe('VOTING');
    g.tick(g.deadline!);
    expect(g.phase).toBe('VOTE_RESULTS');
    g.tick(g.deadline!);
    expect(g.revote).toBe(true);
    g.tick(g.deadline!);
    g.tick(g.deadline!);
    expect(g.phase).toBe('CLUE_ROUND');
    expect(g.round).toBe(2);
  });
  it('keeps vote choices and totals hidden until the ballot closes', () => {
    const g = setup();
    clues(g);
    g.discussed('p0', 10);
    g.vote('p0', 'p1', 10);
    const state = g.publicState(10);
    expect(state.voteCount).toBe(1);
    expect(state.result).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('votes');
    expect(g.privateState('p0').voted).toBe(true);
    expect(g.privateState('p1').voted).toBe(false);
    g.vote('p0', 'p1', 10);
    expect(g.votes.size).toBe(1);
    expect(() => g.vote('p0', 'p2', 10)).toThrow(/locked/);
    expect(() => g.vote('p1', 'p1', 10)).toThrow(/another/);
  });
  it('eliminates the Imposter and gives exactly one correct final guess', () => {
    const g = setup();
    eliminateImposter(g);
    expect(g.phase).toBe('FINAL_GUESS');
    expect(g.result?.counts[g.imposterId]).toBe(2);
    expect(g.result?.wasImposter).toBe(true);
    expect(() =>
      g.guess(
        [...g.players.keys()].find((id) => id !== g.imposterId)!,
        'anything',
      ),
    ).toThrow(/Only/);
    g.guess(g.imposterId, ` ${g.word.toUpperCase()} `);
    expect(g.winner).toBe('imposter');
    expect(() => g.guess(g.imposterId, g.word)).toThrow(/phase/);
    expect(g.privateState(g.imposterId)).not.toHaveProperty('word');
    expect(g.publicState(50)).not.toHaveProperty('word');
  });
  it('awards agents the win for a wrong or timed-out guess', () => {
    const wrong = setup();
    eliminateImposter(wrong);
    wrong.guess(wrong.imposterId, 'definitely wrong');
    expect(wrong.winner).toBe('agents');
    const timeout = setup();
    eliminateImposter(timeout);
    timeout.tick(timeout.deadline!);
    expect(timeout.winner).toBe('agents');
  });
  it('awards the Imposter the win when a regular elimination leaves two', () => {
    const g = setup();
    clues(g);
    g.discussed('p0', 10);
    const target = g.active().find((p) => p.id !== g.imposterId)!.id;
    for (const p of g.active()) g.vote(p.id, p.id === target ? g.imposterId : target, 10);
    g.tick(20);
    expect(g.winner).toBe('imposter');
    expect(g.active()).toHaveLength(2);
  });
  it('continues after a regular elimination with more than two active players', () => {
    const g = setup(4);
    clues(g);
    g.discussed('p0', 10);
    const target = g.active().find((p) => p.id !== g.imposterId)!.id;
    for (const p of g.active()) g.vote(p.id, p.id === target ? g.imposterId : target, 10);
    g.tick(20);
    expect(g.phase).toBe('CLUE_ROUND');
    expect(g.round).toBe(2);
    expect(g.order).not.toContain(target);
    clues(g, 20);
    g.discussed('p0', 20);
    expect(() => g.vote(target, g.imposterId, 20)).toThrow(/Eliminated/);
  });
  it('allows one restricted revote, then eliminates nobody if tied again', () => {
    const g = setup(4);
    clues(g);
    g.discussed('p0', 10);
    for (const [from, to] of [
      ['p0', 'p1'],
      ['p1', 'p0'],
      ['p2', 'p1'],
      ['p3', 'p0'],
    ])
      g.vote(from, to, 10);
    expect(g.result?.tied.sort()).toEqual(['p0', 'p1']);
    g.tick(20);
    expect(g.candidates.sort()).toEqual(['p0', 'p1']);
    expect(g.revote).toBe(true);
    expect(() => g.vote('p0', 'p3', 20)).toThrow(/eligible/);
    for (const [from, to] of [
      ['p0', 'p1'],
      ['p1', 'p0'],
      ['p2', 'p1'],
      ['p3', 'p0'],
    ])
      g.vote(from, to, 20);
    g.tick(30);
    expect(g.phase).toBe('CLUE_ROUND');
    expect(g.active()).toHaveLength(4);
    expect(g.round).toBe(2);
  });
  it('restarts in the same room with fresh, cleared state', () => {
    const g = setup();
    eliminateImposter(g);
    g.guess(g.imposterId, 'wrong');
    g.again('p0');
    expect(g.phase).toBe('LOBBY');
    expect(g.clues).toHaveLength(0);
    expect(g.imposterId).toBe('');
    g.start('p0', 50);
    expect(g.gameId).toBe(2);
    expect(g.players.size).toBe(3);
    expect(g.result).toBeUndefined();
  });
  it('handles permanent departures and transfers the host', () => {
    const g = setup(4);
    const imposter = g.imposterId;
    g.depart(imposter, 1);
    expect(g.winner).toBe('agents');
    const lobby = new Game('ABC234', player('p0'), DEFAULT_SETTINGS);
    lobby.players.set('p1', player('p1'));
    lobby.depart('p0', 0);
    expect(lobby.hostId).toBe('p1');
  });
});

describe('room and data invariants', () => {
  it('does not resurrect permanently departed players on replay', () => {
    const g = setup(4);
    const departedId = g.imposterId;
    g.depart(departedId, 1);
    expect(g.winner).toBe('agents');
    g.again(g.hostId);
    expect(g.players.has(departedId)).toBe(false);
    expect(g.players.size).toBe(3);
    g.start(g.hostId, 2);
    expect(g.phase).toBe('ROLE_REVEAL');
  });
  it('preserves the final guess when a regular player permanently departs', () => {
    const g = setup();
    eliminateImposter(g);
    const agent = g.active()[0];
    g.depart(agent.id, 21);
    expect(g.phase).toBe('FINAL_GUESS');
    g.guess(g.imposterId, g.word);
    expect(g.winner).toBe('imposter');
  });
  it('has at least 150 unique curated words, with every category populated', () => {
    const words = Object.values(WORDS).flat();
    expect(new Set(words).size).toBe(words.length);
    expect(words.length).toBeGreaterThanOrEqual(150);
    expect(Object.values(WORDS).every((w) => w.length >= 25)).toBe(true);
  });
  it('shuffles without losing elements and validates settings', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, clueSeconds: 1 })).toThrow();
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, category: 'made up' })).toThrow();
  });
  it('enforces names, capacity, room codes, random tokens and reconnection grace', () => {
    const m = new RoomManager(100, 500);
    const { game, player: host } = m.create('Alice', DEFAULT_SETTINGS, 's0', 0);
    expect(game.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(host.token).toMatch(/^[a-f0-9]{64}$/);
    expect(() => m.join(game.code, 'ALICE', 's1', 0)).toThrow(/taken/);
    expect(() => m.join('BADBAD', 'Beth', 's1', 0)).toThrow(/not found/);
    for (let i = 1; i < 12; i++) m.join(game.code, `Player ${i}`, `s${i}`, 0);
    expect(() => m.join(game.code, 'Overflow', 's12', 0)).toThrow(/full/);
    m.disconnect(game, host.id, 's0', 10);
    expect(game.player(host.id).connected).toBe(false);
    expect(m.resume(game.code, host.token, 'new', 50).player.id).toBe(host.id);
    m.disconnect(game, host.id, 'new', 60);
    expect(() => m.resume(game.code, host.token, 'late', 200)).toThrow(/expired/);
    m.tick(200, () => {});
    expect(game.hostId).not.toBe(host.id);
  });
  it('cleans abandoned rooms and never disconnects a resumed socket via an old socket', () => {
    const m = new RoomManager(100, 500);
    const { game, player: p } = m.create('Alice', DEFAULT_SETTINGS, 'old', 0);
    m.resume(game.code, p.token, 'new', 1);
    m.disconnect(game, p.id, 'old', 2);
    expect(p.connected).toBe(true);
    m.disconnect(game, p.id, 'new', 3);
    m.tick(600, () => {});
    expect(m.rooms.size).toBe(0);
  });
});
