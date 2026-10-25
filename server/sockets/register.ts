import type { Server, Socket } from 'socket.io';
import type { Action, ClientEvents, Reply, ServerEvents } from '../../shared/types.js';
import type { Game } from '../game/engine.js';
import { RoomManager } from '../rooms/manager.js';
import { requireThat, validateSettings } from '../utils/validation.js';
import { RateLimiter } from '../utils/rate-limit.js';

interface SocketData {
  code?: string;
  playerId?: string;
}
export type GameServer = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
export function registerSockets(io: GameServer, manager: RoomManager, trustProxy: number) {
  const joins = new RateLimiter(40, 60000);
  const creates = new RateLimiter(10, 60000);
  const actions = new RateLimiter(60, 10000);
  function broadcast(game: Game): void {
    io.to(game.code).emit('room:state', game.publicState(Date.now()));
    for (const p of game.players.values())
      if (p.socketId) io.to(p.socketId).emit('player:private', game.privateState(p.id));
  }
  function unlink(socket: GameSocket, reason: string): void {
    if (socket.data.code) void socket.leave(socket.data.code);
    socket.data = {};
    socket.emit('session:ended', reason);
  }
  io.on('connection', (socket) => {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const chain = typeof forwarded === 'string' ? forwarded.split(',').map((s) => s.trim()) : [];
    const ip =
      trustProxy > 0 && chain.length >= trustProxy
        ? chain[chain.length - trustProxy]
        : socket.handshake.address;
    socket.on('action', (raw: Action, ack) => {
      const reply = (r: Reply) => {
        if (typeof ack === 'function') ack(r);
      };
      try {
        const now = Date.now();
        requireThat(actions.allow(socket.id, now), 'Slow down for a moment, then try again.');
        requireThat(
          raw && typeof raw === 'object' && typeof raw.type === 'string',
          'Invalid action.',
        );
        const a = raw;
        if (a.type === 'create' || a.type === 'join' || a.type === 'resume') {
          requireThat(!socket.data.code, 'Leave your current room first.');
          requireThat(joins.allow(ip, now), 'Too many join attempts. Try again in a minute.');
          if (a.type === 'create')
            requireThat(creates.allow(ip, now), 'Too many room creations. Try again in a minute.');
          const outcome =
            a.type === 'create'
              ? manager.create(a.name, a.settings, socket.id, now)
              : a.type === 'join'
                ? manager.join(a.code, a.name, socket.id, now)
                : manager.resume(a.code, a.token, socket.id, now);
          const { game, player } = outcome;
          if (
            'oldSocketId' in outcome &&
            typeof outcome.oldSocketId === 'string' &&
            outcome.oldSocketId !== socket.id
          ) {
            const old = io.sockets.sockets.get(outcome.oldSocketId);
            if (old) unlink(old, 'This session was opened in another tab.');
          }
          socket.data = { code: game.code, playerId: player.id };
          void socket.join(game.code);
          reply({
            ok: true,
            session: { code: game.code, token: player.token, playerId: player.id },
          });
          broadcast(game);
          return;
        }
        const { code, playerId: id } = socket.data;
        requireThat(code && id, 'Join a room first.');
        const game = manager.get(code);
        requireThat(game.player(id).socketId === socket.id, 'Your session is no longer active.');
        // Enforce timestamp deadlines even when an action races the interval callback.
        if (game.tick(now)) broadcast(game);
        switch (a.type) {
          case 'settings':
            game.host(id);
            game.inPhase('LOBBY');
            game.settings = validateSettings(a.settings);
            break;
          case 'kick': {
            game.host(id);
            game.inPhase('LOBBY');
            requireThat(a.playerId !== id, 'The host cannot remove themselves.');
            const target = game.player(a.playerId);
            const targetSocket = target.socketId
              ? io.sockets.sockets.get(target.socketId)
              : undefined;
            manager.depart(game, target.id, now);
            if (targetSocket) unlink(targetSocket, 'The host removed you from the room.');
            break;
          }
          case 'start':
            game.start(id, now);
            break;
          case 'ready':
            game.ready(id, now);
            break;
          case 'clue':
            game.clue(id, a.text, now);
            break;
          case 'discussed':
            game.discussed(id, now);
            break;
          case 'vote':
            game.vote(id, a.playerId, now);
            break;
          case 'guess':
            game.guess(id, a.text);
            break;
          case 'again':
            game.again(id);
            break;
          case 'leave':
            manager.depart(game, id, now);
            unlink(socket, 'You left the room.');
            break;
          default:
            throw new Error('Unknown action.');
        }
        manager.touch(game, now);
        broadcast(game);
        reply({ ok: true });
      } catch (error) {
        reply({
          ok: false,
          error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        });
      }
    });
    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      if (code && playerId) {
        const entry = manager.rooms.get(code);
        if (entry) {
          manager.disconnect(entry.game, playerId, socket.id, Date.now());
          broadcast(entry.game);
        }
      }
    });
  });
  const interval = setInterval(() => {
    const now = Date.now();
    manager.tick(now, broadcast);
    joins.cleanup(now);
    creates.cleanup(now);
    actions.cleanup(now);
  }, 250);
  interval.unref();
  return () => clearInterval(interval);
}
