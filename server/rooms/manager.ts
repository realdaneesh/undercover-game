import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Game, type Durations, type Player } from '../game/engine.js';
import type { Settings } from '../../shared/types.js';
import { cleanText, requireThat, validateSettings } from '../utils/validation.js';

export interface RoomEntry {
  game: Game;
  emptySince?: number;
  touchedAt: number;
}
export class RoomManager {
  rooms = new Map<string, RoomEntry>();
  constructor(
    public graceMs = 60000,
    public emptyTtlMs = 600000,
    private durations?: Durations,
  ) {}
  private newPlayer(name: unknown, socketId: string, color: number): Player {
    return {
      id: randomUUID(),
      token: randomBytes(32).toString('hex'),
      name: cleanText(name, 2, 18, 'Nickname'),
      color,
      connected: true,
      active: true,
      ready: false,
      socketId,
    };
  }
  create(
    name: unknown,
    settings: Settings,
    socketId: string,
    now: number,
  ): { game: Game; player: Player } {
    requireThat(this.rooms.size < 500, 'The server is busy. Please try again shortly.');
    let code = '';
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
      code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    } while (this.rooms.has(code));
    const player = this.newPlayer(name, socketId, 0);
    const game = new Game(code, player, validateSettings(settings), this.durations);
    this.rooms.set(code, { game, touchedAt: now });
    return { game, player };
  }
  get(code: unknown): Game {
    requireThat(
      typeof code === 'string' && /^[A-Z2-9]{6}$/.test(code),
      'Enter a six-character room code.',
    );
    const entry = this.rooms.get(code);
    requireThat(entry, 'Room not found. Check the code or create a new room.');
    return entry.game;
  }
  join(
    code: unknown,
    name: unknown,
    socketId: string,
    now: number,
  ): { game: Game; player: Player } {
    const game = this.get(code);
    game.inPhase('LOBBY');
    requireThat(game.players.size < 12, 'This room is full (12 players).');
    const nick = cleanText(name, 2, 18, 'Nickname');
    requireThat(
      ![...game.players.values()].some(
        (p) => p.name.toLocaleLowerCase('en') === nick.toLocaleLowerCase('en'),
      ),
      'That nickname is taken. Try another.',
    );
    const color =
      Array.from({ length: 12 }, (_, i) => i).find(
        (i) => ![...game.players.values()].some((p) => p.color === i),
      ) ?? 0;
    const player = this.newPlayer(nick, socketId, color);
    game.players.set(player.id, player);
    this.touch(game, now);
    return { game, player };
  }
  resume(
    code: unknown,
    token: unknown,
    socketId: string,
    now: number,
  ): { game: Game; player: Player; oldSocketId?: string } {
    const game = this.get(code);
    requireThat(
      typeof token === 'string' && /^[a-f0-9]{64}$/.test(token),
      'Your session has expired. Join the room again.',
    );
    const player = [...game.players.values()].find((p) => p.token === token);
    requireThat(player, 'Your session has expired. Join the room again.');
    requireThat(
      player.disconnectedAt === undefined || now - player.disconnectedAt < this.graceMs,
      'Reconnect grace period expired.',
    );
    const oldSocketId = player.socketId;
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = undefined;
    if (!game.players.get(game.hostId)?.connected && !game.hostId) game.hostId = player.id;
    this.touch(game, now);
    return { game, player, oldSocketId };
  }
  disconnect(game: Game, id: string, socketId: string, now: number): void {
    const p = game.players.get(id);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = undefined;
    p.disconnectedAt = now;
    this.touch(game, now);
  }
  depart(game: Game, id: string, now: number): void {
    const p = game.players.get(id);
    if (!p) return;
    p.token = '';
    p.disconnectedAt = undefined;
    game.depart(id, now);
    this.touch(game, now);
  }
  touch(game: Game, now: number): void {
    const entry = this.rooms.get(game.code);
    if (!entry) return;
    entry.touchedAt = now;
    if ([...game.players.values()].some((p) => p.connected)) entry.emptySince = undefined;
    else entry.emptySince ??= now;
  }
  tick(now: number, changed: (game: Game) => void): void {
    for (const [code, entry] of this.rooms) {
      const game = entry.game;
      let dirty = false;
      for (const p of [...game.players.values()]) {
        if (
          !p.connected &&
          p.disconnectedAt !== undefined &&
          now - p.disconnectedAt >= this.graceMs
        ) {
          this.depart(game, p.id, now);
          dirty = true;
        }
      }
      if (game.tick(now)) dirty = true;
      this.touchEmpty(entry, now);
      if (
        (entry.emptySince !== undefined && now - entry.emptySince >= this.emptyTtlMs) ||
        game.players.size === 0
      ) {
        this.rooms.delete(code);
        continue;
      }
      if (dirty) changed(game);
    }
  }
  private touchEmpty(entry: RoomEntry, now: number): void {
    if (![...entry.game.players.values()].some((p) => p.connected)) entry.emptySince ??= now;
  }
}
