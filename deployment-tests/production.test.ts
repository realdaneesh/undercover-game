import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import type {
  Action,
  ClientEvents,
  PrivatePlayer,
  Reply,
  ServerEvents,
  Session,
} from '../shared/types.js';

const root = process.cwd();
const origin = 'https://undercover-frontend.example';
type Client = Socket<ServerEvents, ClientEvents>;
let backend: ChildProcessWithoutNullStreams;
let base: string;
const clients: Client[] = [];

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No smoke-test port available.');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
async function connect(): Promise<Client> {
  const socket: Client = io(base, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: { Origin: origin },
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function action(socket: Client, value: Action): Promise<Session | undefined> {
  const reply = await new Promise<Reply>((resolve, reject) =>
    socket
      .timeout(5000)
      .emit('action', value, (error: Error | null, reply: Reply) =>
        error ? reject(error) : resolve(reply),
      ),
  );
  if (!reply.ok) throw new Error(reply.error);
  return reply.session;
}

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const pkg = JSON.parse(await readFile(resolve(root, 'server/package.json'), 'utf8'));
  expect(pkg.scripts.start).toBe('node --env-file-if-exists=.env dist/server/index.js');
  backend = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/server/index.js'], {
    cwd: resolve(root, 'server'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      CLIENT_ORIGINS: origin,
      TRUST_PROXY: '1',
    },
    stdio: 'pipe',
  });
  await new Promise<void>((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(
      () => reject(new Error(`Compiled backend did not start. ${stderr}`)),
      10000,
    );
    backend.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    backend.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`listening on port ${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    backend.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    backend.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Backend exited (${code}). ${stderr}`));
    });
  });
});
afterAll(async () => {
  clients.forEach((socket) => socket.disconnect());
  if (backend && backend.exitCode === null && backend.signalCode === null) {
    const closed = once(backend, 'close');
    backend.kill();
    await closed;
  }
});

describe('compiled deployment artifacts and production runtime', () => {
  it('emits shared JavaScript beside the compiled backend entry point', async () => {
    await access(resolve(root, 'server/dist/server/index.js'));
    const shared = await import(pathToFileURL(resolve(root, 'server/dist/shared/types.js')).href);
    expect(shared.CATEGORIES).toHaveLength(6);
    expect(shared.DEFAULT_SETTINGS.mode).toBe('classic');
  });
  it('builds the Vercel artifact with bundled shared code and no development server fallback', async () => {
    const html = await readFile(resolve(root, 'client/dist/index.html'), 'utf8');
    expect(html).toContain('UNDERCOVER');
    const files = await readdir(resolve(root, 'client/dist/assets'));
    const bundle = (
      await Promise.all(
        files
          .filter((file) => file.endsWith('.js'))
          .map((file) => readFile(resolve(root, 'client/dist/assets', file), 'utf8')),
      )
    ).join('\n');
    expect(bundle).toContain('All categories');
    expect(bundle).not.toContain('http://localhost:3001');
    if (process.env.VITE_SERVER_URL) expect(bundle).toContain(process.env.VITE_SERVER_URL);
  });
  it('serves health and restricts polling CORS to the production frontend', async () => {
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      status: 'ok',
      service: 'undercover',
      storage: 'in-memory',
    });
    const allowed = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: origin },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
    await allowed.text();
    const denied = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    await denied.text();
  });
  it('joins three WebSocket clients on the compiled backend and restores a session', async () => {
    const sockets = await Promise.all([connect(), connect(), connect()]);
    const host = (await action(sockets[0], {
      type: 'create',
      name: 'Production A',
      settings: { mode: 'classic', clueSeconds: 30, category: 'All categories' },
    }))!;
    const sessions = [host];
    for (let i = 1; i < 3; i++)
      sessions.push(
        (await action(sockets[i], { type: 'join', code: host.code, name: `Production ${i}` }))!,
      );
    const roles = sockets.map(
      (socket) =>
        new Promise<PrivatePlayer>((resolve) => {
          const listener = (state: PrivatePlayer) => {
            if (state.role) {
              socket.off('player:private', listener);
              resolve(state);
            }
          };
          socket.on('player:private', listener);
        }),
    );
    await action(sockets[0], { type: 'start' });
    const states = await Promise.all(roles);
    expect(states.filter((state) => state.role === 'imposter')).toHaveLength(1);
    expect(states.find((state) => state.role === 'imposter')).not.toHaveProperty('word');
    expect(
      new Set(states.filter((state) => state.role === 'agent').map((state) => state.word)).size,
    ).toBe(1);
    sockets[1].disconnect();
    const replacement = await connect();
    expect(
      (await action(replacement, { type: 'resume', code: host.code, token: sessions[1].token }))
        ?.playerId,
    ).toBe(sessions[1].playerId);
  });
  it('rejects a WebSocket handshake from an unlisted frontend origin', async () => {
    const blocked: Client = io(base, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: 'https://untrusted.example' },
    });
    clients.push(blocked);
    await new Promise<void>((resolve, reject) => {
      blocked.once('connect_error', () => resolve());
      blocked.once('connect', () => reject(new Error('Origin restriction bypassed.')));
    });
  });
});
