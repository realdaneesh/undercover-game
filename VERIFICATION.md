# Verification record

Verified locally on 25 October 2026 with Windows, Node 24.13.1, npm 11.8.0, and installed Google Chrome.

| Check                                  | Result                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --include=dev`                 | Passed with `NODE_ENV=production`; build tools remain available                                                                   |
| `npm run typecheck`                    | Passed for client and server                                                                                                      |
| `npm test`                             | 39 passed across engine/room/data, concurrent Socket.IO, and deployment configuration tests                                       |
| `npm run build`                        | Passed; compiled backend and Vite frontend generated                                                                              |
| `npm run test:e2e`                     | 2 passed; three-player browser flow and narrow-phone UI                                                                           |
| `npm audit`                            | 0 vulnerabilities reported                                                                                                        |
| Compiled production backend smoke test | Passed with `NODE_ENV=production`, configured HTTPS origin, custom `PORT`, `/health` HTTP 200, and 3 concurrent WebSocket clients |
| `npm run test:deployment`              | 5 passed against the compiled production artifacts and backend                                                                    |

The deployment review constrained Node to 24.x, made Vercel explicitly include build dependencies, expanded secret-file ignore rules, validated bare HTTP(S) origins, and added Render build filters. Gameplay engine code was not changed. A standalone client build ran successfully before the server build; no prebuilt shared package was required. The server build emitted `server/dist/server/index.js` and `server/dist/shared/{types,urls}.js`, matching the workspace start script and imports.

The production build check used `VITE_SERVER_URL=https://undercover-backend.example` as a **local artifact-test value**, not a real endpoint. The resulting client bundle contained that configured value and no `http://localhost:3001` fallback. Production runtime tests used local HTTP transport with an allowed HTTPS Origin header; public TLS and hosted endpoints remain unverified.

The pre-push file review found no real environment files or actual credential markers among 55 publish candidates. The one URL containing dummy credentials in a negative configuration test was reviewed as an intentional invalid fixture. `.env`, production/preview variants, `.npmrc`, and private-key files are ignored; all three `.env.example` templates remain eligible for source control. There are no tracked files, commits, or remote in the inspected checkout, so there are no committed secrets in this repository history.

The browser flow used three isolated storage contexts at 1440×1000, 390×844 with mobile/touch emulation, and 768×1024. It created a room, joined via invitation links, refreshed a lobby player, started a game, privately revealed roles, refreshed the Imposter during play, submitted three clues, opened voting, eliminated the Imposter, submitted a correct final guess, and started another game in the same room. No browser page errors were observed. A separate test checked rules, forms, and room creation at 320 px. Layout checks found no horizontal page overflow. Screenshots were captured and visually inspected.

Socket integration tests additionally verified 12 concurrent players, rejection of a thirteenth player, equal agent words, exactly one Imposter, private role payloads, hidden ballots, duplicate vote prevention, host authorization, disallowed-origin rejection, session replacement, pregame removal, permanent host transfer, and replay. Engine tests cover one revote followed by a second tie, regular-player elimination, both final-guess outcomes, timer expiry, skipped turns, abandoned-room cleanup, and replay after permanent departure.

Browser screenshots and traces are generated under ignored `test-results/`; the HTML browser report is under ignored `playwright-report/`. Re-run `npm run test:e2e` to regenerate them.

## Verification limits

- Public Vercel and Render endpoints have **not** been created or tested. Hosting configuration is supplied, not a deployment success claim.
- Phones and tablets were emulated in Chrome. Physical-device testing and Safari/Firefox testing remain deployment acceptance checks.
- Git is initialized locally; a GitHub remote and hosting-account connections have not been configured.
- No load or denial-of-service benchmark is claimed. Twelve concurrent game clients were functionally tested.
- Double Agent is deferred. Classic Imposter is the implemented mode.
- Rooms use one backend process's memory and are lost on restart or redeployment, as documented in [DEPLOYMENT.md](DEPLOYMENT.md).
