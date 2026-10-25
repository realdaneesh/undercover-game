import type { Session } from '../../../shared/types';
const KEY = 'undercover.session.v1';
export function readSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s &&
      typeof s.playerId === 'string' &&
      /^[A-Z2-9]{6}$/.test(s.code) &&
      /^[a-f0-9]{64}$/.test(s.token)
      ? s
      : null;
  } catch {
    return null;
  }
}
export function saveSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Gameplay remains available if browser storage is disabled.
  }
}
