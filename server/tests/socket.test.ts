import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createApp } from '../app.js';
import { RoomManager } from '../rooms/manager.js';
import {
  DEFAULT_SETTINGS,
  type Action,
  type ClientEvents,
  type PrivatePlayer,
  type PublicRoom,
  type Reply,
  type ServerEvents,
  type Session,
} from '../../shared/types.js';

type Client = Socket<ServerEvents, ClientEvents>;
const clients: Client[] = [];
let app: ReturnType<typeof createApp> | undefined;
async function server(manager?: RoomManager) {
  app = createApp({ manager });
  await new Promise<void>((resolve) => app!.http.listen(0, '127.0.0.1', resolve));
  const address = app.http.address();
  if (!address || typeof address === 'string') throw new Error('No test server');
  return `http://127.0.0.1:${address.port}`;
}
async function connect(url: string): Promise<Client> {
  const socket: Client = io(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
function action(socket: Client, a: Action): Promise<Reply> {
  return new Promise((resolve) => socket.emit('action', a, resolve));
}
async function ok(socket: Client, a: Action): Promise<Session | undefined> {
  const reply = await action(socket, a);
  if (!reply.ok) throw new Error(reply.error);
  return reply.session;
}
function waitUntil(predicate: () => boolean, ms = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + ms;
    const poll = setInterval(() => {
      if (predicate()) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error('State did not arrive'));
      }
    }, 10);
  });
}
afterEach(async () => {
  clients.splice(0).forEach((s) => s.disconnect());
  await app?.close();
  app = undefined;
});

describe('real concurrent Socket.IO clients', () => {
  it('synchronizes twelve concurrent players and rejects a thirteenth player', async () => {
    const url = await server();
    const sockets = await Promise.all(Array.from({ length: 13 }, () => connect(url)));
    const session = (await ok(sockets[0], {
      type: 'create',
      name: 'Player 0',
      settings: DEFAULT_SETTINGS,
    }))!;
    const states: (PublicRoom | undefined)[] = [];
    const roles: (PrivatePlayer | undefined)[] = [];
    sockets.slice(0, 12).forEach((s, i) => {
      s.on('room:state', (state) => {
        states[i] = state;
      });
      s.on('player:private', (state) => {
        roles[i] = state;
      });
    });
    await Promise.all(
      sockets
        .slice(1, 12)
        .map((s, i) => ok(s, { type: 'join', code: session.code, name: `Player ${i + 1}` })),
    );
    await waitUntil(() => states.filter((s) => s?.players.length === 12).length === 12);
    const overflow = await action(sockets[12], {
      type: 'join',
      code: session.code,
      name: 'Overflow',
    });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error).toContain('full');
    await ok(sockets[0], { type: 'start' });
    await waitUntil(() => roles.filter((r) => r?.role).length === 12);
    expect(roles.filter((r) => r?.role === 'imposter')).toHaveLength(1);
    const word = roles.find((r) => r?.role === 'agent')!.word;
    expect(roles.filter((r) => r?.role === 'agent').every((r) => r!.word === word)).toBe(true);
    expect(roles.find((r) => r?.role === 'imposter')).not.toHaveProperty('word');
  });
  it('plays a full three-player game, hides secrets, restores a refreshed session, and plays again', async () => {
    const url = await server(
      new RoomManager(60000, 600000, {
        reveal: 25000,
        discussion: 120000,
        voting: 30000,
        results: 30,
        guess: 30000,
      }),
    );
    const sockets = await Promise.all([connect(url), connect(url), connect(url)]);
    const states: (PublicRoom | undefined)[] = [];
    const secrets: (PrivatePlayer | undefined)[] = [];
    const history: unknown[][] = [[], [], []];
    sockets.forEach((s, i) => {
      s.on('room:state', (state) => {
        states[i] = state;
        history[i].push(state);
      });
      s.on('player:private', (p) => {
        secrets[i] = p;
        history[i].push(p);
      });
    });
    const sessions = [
      (await ok(sockets[0], { type: 'create', name: 'Alice', settings: DEFAULT_SETTINGS }))!,
    ];
    for (let i = 1; i < 3; i++)
      sessions.push(
        (await ok(sockets[i], {
          type: 'join',
          code: sessions[0].code,
          name: ['Alice', 'Beth', 'Cameron'][i],
        }))!,
      );
    await waitUntil(() => states.every((s) => s?.players.length === 3));
    expect((await action(sockets[1], { type: 'start' })).ok).toBe(false);
    await ok(sockets[0], { type: 'start' });
    await waitUntil(() => secrets.filter((s) => s?.role).length === 3);
    const imp = secrets.findIndex((s) => s?.role === 'imposter');
    const word = secrets.find((s) => s?.role === 'agent')!.word!;
    expect(imp).toBeGreaterThanOrEqual(0);
    expect(secrets.filter((s) => s?.role === 'imposter')).toHaveLength(1);
    expect(secrets.filter((s) => s?.role === 'agent').every((s) => s!.word === word)).toBe(true);
    expect(JSON.stringify(history[imp])).not.toContain(word);
    await Promise.all(sockets.map((s) => ok(s, { type: 'ready' })));
    await waitUntil(() => states[0]?.phase === 'CLUE_ROUND');
    const refreshIndex = imp;
    const oldId = sessions[refreshIndex].playerId;
    sockets[refreshIndex].disconnect();
    sockets[refreshIndex] = await connect(url);
    sockets[refreshIndex].on('room:state', (s) => {
      states[refreshIndex] = s;
      history[imp].push(s);
    });
    sockets[refreshIndex].on('player:private', (s) => {
      secrets[refreshIndex] = s;
      history[imp].push(s);
    });
    const resumed = await ok(sockets[refreshIndex], {
      type: 'resume',
      code: sessions[refreshIndex].code,
      token: sessions[refreshIndex].token,
    });
    expect(resumed?.playerId).toBe(oldId);
    await waitUntil(() => states[refreshIndex]?.players.every((p) => p.connected) === true);
    const order = [...states[0]!.order];
    for (const id of order) {
      const index = sessions.findIndex((s) => s.playerId === id);
      await ok(sockets[index], { type: 'clue', text: `a clue ${index}` });
    }
    await waitUntil(() => states.every((s) => s?.phase === 'DISCUSSION'));
    expect(states.every((s) => s!.clues.length === 3)).toBe(true);
    await ok(sockets[0], { type: 'discussed' });
    const agentIndex = sessions.findIndex((_, i) => i !== imp);
    await ok(sockets[agentIndex], { type: 'vote', playerId: sessions[imp].playerId });
    await ok(sockets[agentIndex], { type: 'vote', playerId: sessions[imp].playerId });
    expect(
      (
        await action(sockets[agentIndex], {
          type: 'vote',
          playerId: sessions.find((_, i) => i !== agentIndex && i !== imp)!.playerId,
        })
      ).ok,
    ).toBe(false);
    await waitUntil(() => states[0]?.voteCount === 1);
    expect(states[0]!.result).toBeUndefined();
    for (let i = 0; i < 3; i++)
      if (i !== agentIndex)
        await ok(sockets[i], {
          type: 'vote',
          playerId: sessions[i === imp ? agentIndex : imp].playerId,
        });
    await waitUntil(() => states[0]?.phase === 'FINAL_GUESS');
    expect(states[0]!.result?.counts[sessions[imp].playerId]).toBe(2);
    expect(states[0]!.result?.eliminatedId).toBe(sessions[imp].playerId);
    expect(JSON.stringify(history[imp])).not.toContain(word);
    await ok(sockets[imp], { type: 'guess', text: word });
    await waitUntil(() => states.every((s) => s?.phase === 'GAME_OVER'));
    expect(states[0]!.winner).toBe('imposter');
    await ok(sockets[0], { type: 'again' });
    await ok(sockets[0], { type: 'start' });
    await waitUntil(() => states[0]?.gameId === 2);
    expect(states[0]!.players).toHaveLength(3);
    expect((await fetch(`${url}/health`)).status).toBe(200);
  });
  it('rejects invalid payloads, unauthorized actions, duplicate names, expired tokens and disallowed origins', async () => {
    const url = await server();
    const [host, guest] = await Promise.all([connect(url), connect(url)]);
    const session = (await ok(host, {
      type: 'create',
      name: 'Alice',
      settings: DEFAULT_SETTINGS,
    }))!;
    expect((await action(guest, { type: 'join', code: session.code, name: 'alice' })).ok).toBe(
      false,
    );
    await ok(guest, { type: 'join', code: session.code, name: 'Beth' });
    expect((await action(guest, { type: 'settings', settings: DEFAULT_SETTINGS })).ok).toBe(false);
    expect((await action(guest, { type: 'kick', playerId: session.playerId })).ok).toBe(false);
    expect((await action(guest, null as unknown as Action)).ok).toBe(false);
    const stranger = await connect(url);
    expect(
      (await action(stranger, { type: 'resume', code: session.code, token: 'a'.repeat(64) })).ok,
    ).toBe(false);
    const blocked = io(url, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { origin: 'https://untrusted.example' },
    });
    clients.push(blocked);
    await new Promise<void>((resolve, reject) => {
      blocked.on('connect_error', () => resolve());
      blocked.on('connect', () => reject(new Error('Origin bypass')));
    });
  });
  it('replaces an old tab safely, kicks players, and transfers a permanently disconnected host', async () => {
    const url = await server(new RoomManager(50, 10000));
    const [host, guest, replacement] = await Promise.all([
      connect(url),
      connect(url),
      connect(url),
    ]);
    const hs = (await ok(host, { type: 'create', name: 'Alice', settings: DEFAULT_SETTINGS }))!;
    const gs = (await ok(guest, { type: 'join', code: hs.code, name: 'Beth' }))!;
    let replaced = '';
    host.on('session:ended', (reason) => {
      replaced = reason;
    });
    await ok(replacement, { type: 'resume', code: hs.code, token: hs.token });
    await waitUntil(() => !!replaced);
    expect((await action(host, { type: 'start' })).ok).toBe(false);
    await ok(replacement, { type: 'kick', playerId: gs.playerId });
    expect((await action(guest, { type: 'resume', code: hs.code, token: gs.token })).ok).toBe(
      false,
    );
    const gs2 = (await ok(guest, { type: 'join', code: hs.code, name: 'Beth' }))!;
    let state: PublicRoom | undefined;
    guest.on('room:state', (s) => {
      state = s;
    });
    replacement.disconnect();
    await waitUntil(() => state?.hostId === gs2.playerId);
    expect(state!.players).toHaveLength(1);
  });
});
