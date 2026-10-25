import { httpOrigin } from '../shared/urls.js';

export function readConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535.');
  const supplied = env.CLIENT_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (production && !supplied?.length)
    throw new Error('Set CLIENT_ORIGINS to the exact HTTPS frontend origin(s).');
  const origins = (supplied?.length ? supplied : ['http://localhost:5173']).map((value) => {
    const origin = httpOrigin(value, production);
    if (!origin)
      throw new Error(
        'CLIENT_ORIGINS must contain exact HTTP(S) origins, HTTPS in production, without paths, credentials, queries, or wildcards.',
      );
    return origin;
  });
  const proxy = Number(env.TRUST_PROXY ?? 0);
  if (!Number.isInteger(proxy) || proxy < 0 || proxy > 5)
    throw new Error('TRUST_PROXY must be an integer from 0 to 5.');
  return { port, origins: [...new Set(origins)], proxy };
}
