export const CATEGORIES = [
  'Food',
  'Animals',
  'Technology',
  'Entertainment',
  'Places',
  'Everyday objects',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Phase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'CLUE_ROUND'
  | 'DISCUSSION'
  | 'VOTING'
  | 'VOTE_RESULTS'
  | 'FINAL_GUESS'
  | 'GAME_OVER';
export interface Settings {
  mode: 'classic';
  clueSeconds: 20 | 30 | 45 | 60;
  category: Category | 'All categories';
}
export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  clueSeconds: 30,
  category: 'All categories',
};
export interface PublicPlayer {
  id: string;
  name: string;
  color: number;
  connected: boolean;
  active: boolean;
  ready: boolean;
}
export interface Clue {
  playerId: string;
  round: number;
  text: string;
  skipped: boolean;
}
export interface VoteResult {
  counts: Record<string, number>;
  tied: string[];
  eliminatedId?: string;
  wasImposter?: boolean;
  revote: boolean;
}
export interface PublicRoom {
  code: string;
  hostId: string;
  phase: Phase;
  settings: Settings;
  players: PublicPlayer[];
  round: number;
  gameId: number;
  order: string[];
  turnId?: string;
  clues: Clue[];
  deadline: number | null;
  serverTime: number;
  voteCount: number;
  candidates: string[];
  revote: boolean;
  result?: VoteResult;
  winner?: 'agents' | 'imposter';
  reason?: string;
  imposterId?: string;
}
export interface PrivatePlayer {
  id: string;
  role?: 'agent' | 'imposter';
  word?: string;
  voted: boolean;
  ready: boolean;
}
export interface Session {
  code: string;
  token: string;
  playerId: string;
}
export type Action =
  | { type: 'create'; name: string; settings: Settings }
  | { type: 'join'; code: string; name: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'settings'; settings: Settings }
  | { type: 'kick'; playerId: string }
  | { type: 'start' }
  | { type: 'ready' }
  | { type: 'clue'; text: string }
  | { type: 'vote'; playerId: string }
  | { type: 'discussed' }
  | { type: 'guess'; text: string }
  | { type: 'again' }
  | { type: 'leave' };
export type Reply = { ok: true; session?: Session } | { ok: false; error: string };
export interface ServerEvents {
  'room:state': (room: PublicRoom) => void;
  'player:private': (player: PrivatePlayer) => void;
  'session:ended': (reason: string) => void;
}
export interface ClientEvents {
  action: (action: Action, ack: (reply: Reply) => void) => void;
}
