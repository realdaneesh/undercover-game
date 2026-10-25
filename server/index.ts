import { createApp } from './app.js';
import { readConfig } from './config.js';
const { port, origins, proxy } = readConfig(process.env);
const server = createApp({ origins, trustProxy: proxy });
server.http.listen(port, '0.0.0.0', () =>
  console.log(`UNDERCOVER server listening on port ${port}`),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await server.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
