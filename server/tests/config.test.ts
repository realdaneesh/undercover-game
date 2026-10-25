import { describe, expect, it } from 'vitest';
import { readConfig } from '../config.js';
import { httpOrigin } from '../../shared/urls.js';

describe('deployment configuration', () => {
  it('keeps HTTP localhost defaults confined to development', () => {
    expect(readConfig({})).toEqual({ port: 3001, origins: ['http://localhost:5173'], proxy: 0 });
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow(/CLIENT_ORIGINS/);
    expect(httpOrigin('', true)).toBeNull();
    expect(httpOrigin('http://localhost:3001', true)).toBeNull();
  });
  it('reads Render PORT and normalizes exact production origins', () => {
    expect(
      readConfig({
        NODE_ENV: 'production',
        PORT: '10000',
        CLIENT_ORIGINS: ' https://game.example/,https://other.example,https://game.example ',
        TRUST_PROXY: '1',
      }),
    ).toEqual({
      port: 10000,
      origins: ['https://game.example', 'https://other.example'],
      proxy: 1,
    });
    expect(httpOrigin(' https://backend.example/ ', true)).toBe('https://backend.example');
  });
  it.each([
    'https://game.example/path',
    'https://*.vercel.app',
    'https://name:password@game.example',
    'https://game.example?token=value',
    'https://game.example#section',
    'wss://game.example',
    'http://game.example',
    'not-a-url',
  ])('rejects a misconfigured production origin: %s', (value) => {
    expect(() => readConfig({ NODE_ENV: 'production', CLIENT_ORIGINS: value })).toThrow(
      /CLIENT_ORIGINS/,
    );
    expect(httpOrigin(value, true)).toBeNull();
  });
  it.each(['0', '65536', '-1', 'abc', '3001.5', ''])('rejects an invalid port: %s', (PORT) => {
    expect(() => readConfig({ PORT })).toThrow(/PORT/);
  });
  it('rejects invalid proxy configuration', () => {
    expect(() => readConfig({ TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
    expect(() => readConfig({ TRUST_PROXY: '6' })).toThrow(/TRUST_PROXY/);
  });
});
