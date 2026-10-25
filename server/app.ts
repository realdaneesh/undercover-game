import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/manager.js';
import { registerSockets, type GameServer } from './sockets/register.js';

export interface AppOptions {
  origins?: string[];
  trustProxy?: number;
  manager?: RoomManager;
}
export function createApp(options: AppOptions = {}) {
  const origins = options.origins ?? ['http://localhost:5173'];
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxy ?? 0);
  app.use(helmet());
  app.get('/health', (_req, res) =>
    res.status(200).json({ status: 'ok', service: 'undercover', storage: 'in-memory' }),
  );
  const http = createServer(app);
  const io: GameServer = new Server(http, {
    cors: { origin: origins, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) =>
      callback(null, !req.headers.origin || origins.includes(req.headers.origin)),
    maxHttpBufferSize: 8192,
    pingTimeout: 20000,
    pingInterval: 25000,
  });
  const manager = options.manager ?? new RoomManager();
  const stop = registerSockets(io, manager, options.trustProxy ?? 0);
  return {
    app,
    http,
    io,
    manager,
    close: async () => {
      stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
