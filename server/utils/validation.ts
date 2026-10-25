import { randomInt } from 'node:crypto';
import { CATEGORIES, type Settings } from '../../shared/types.js';
export function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function cleanText(value: unknown, min: number, max: number, label: string): string {
  requireThat(typeof value === 'string', `${label} is required.`);
  const text = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  requireThat(
    text.length >= min && text.length <= max,
    `${label} must be ${min}–${max} characters.`,
  );
  return text;
}
export function validateSettings(value: unknown): Settings {
  requireThat(value && typeof value === 'object', 'Invalid game settings.');
  const s = value as Settings;
  requireThat(s.mode === 'classic', 'Choose Classic Imposter.');
  requireThat([20, 30, 45, 60].includes(s.clueSeconds), 'Choose a valid clue timer.');
  requireThat(
    s.category === 'All categories' || CATEGORIES.includes(s.category),
    'Choose a valid category.',
  );
  return { mode: 'classic', clueSeconds: s.clueSeconds, category: s.category };
}
export function shuffle<T>(items: T[], pick = randomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function normalizeGuess(text: string): string {
  return text.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
}
