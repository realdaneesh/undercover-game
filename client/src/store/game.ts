import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type {
  Action,
  ClientEvents,
  PrivatePlayer,
  PublicRoom,
  Reply,
  ServerEvents,
  Session,
} from '../../../shared/types';

import { readSession, saveSession } from '../lib/session';
import { httpOrigin } from '../../../shared/urls';
const url = httpOrigin(
  import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''),
  import.meta.env.PROD,
);
const validUrl = url !== null;
const socket: Socket<ServerEvents, ClientEvents> = io(validUrl ? url : undefined, {
  autoConnect: false,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 12000,
});

interface Store {
  room: PublicRoom | null;
  me: PrivatePlayer | null;
  session: Session | null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'configuration';
  restoring: boolean;
  busy: boolean;
  error: string | null;
  clockOffset: number;
  action: (a: Action) => Promise<boolean>;
  clearError: () => void;
}
export const useGame = create<Store>((set, get) => ({
  room: null,
  me: null,
  session: readSession(),
  connection: validUrl ? 'connecting' : 'configuration',
  restoring: !!readSession(),
  busy: false,
  error: validUrl
    ? null
    : 'Set VITE_SERVER_URL to the HTTPS backend origin without a path, credentials, or query, then rebuild.',
  clockOffset: 0,
  clearError: () => set({ error: null }),
  action: async (a) => {
    if (!socket.connected) {
      set({ error: 'Still connecting to the game server. Please wait a moment.' });
      return false;
    }
    if (get().busy) return false;
    set({ busy: true, error: null });
    return new Promise<boolean>((resolve) => {
      socket.timeout(12000).emit('action', a, (err: Error | null, reply: Reply) => {
        set({ busy: false });
        if (err) {
          set({
            error: 'The server took too long to respond. Check your connection and try again.',
          });
          resolve(false);
          return;
        }
        if (!reply.ok) {
          set({ error: reply.error });
          resolve(false);
          return;
        }
        if (reply.session) {
          saveSession(reply.session);
          set({ session: reply.session });
        }
        resolve(true);
      });
    });
  },
}));
socket.on('connect', () => {
  useGame.setState({ connection: 'connected' });
  const session = useGame.getState().session;
  if (!session) {
    useGame.setState({ restoring: false });
    return;
  }
  useGame.setState({ restoring: true });
  socket
    .timeout(12000)
    .emit(
      'action',
      { type: 'resume', code: session.code, token: session.token },
      (err: Error | null, reply: Reply) => {
        if (err) {
          socket.disconnect().connect();
          return;
        }
        if (!reply.ok) {
          saveSession(null);
          useGame.setState({ session: null, room: null, me: null, error: reply.error });
        } else if (reply.session) {
          saveSession(reply.session);
          useGame.setState({ session: reply.session });
        }
        useGame.setState({ restoring: false });
      },
    );
});
socket.on('disconnect', () => useGame.setState({ connection: 'reconnecting', busy: false }));
socket.on('connect_error', () => useGame.setState({ connection: 'reconnecting' }));
socket.on('room:state', (room) =>
  useGame.setState({ room, clockOffset: room.serverTime - Date.now() }),
);
socket.on('player:private', (me) => useGame.setState({ me }));
socket.on('session:ended', (reason) => {
  if (!reason.includes('another tab')) saveSession(null);
  useGame.setState({
    room: null,
    me: null,
    session: null,
    restoring: false,
    busy: false,
    error: reason === 'You left the room.' ? null : reason,
  });
});
if (validUrl) socket.connect();
