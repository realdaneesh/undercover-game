# Public multiplayer deployment

Deployment targets: **GitHub source**, **Vercel frontend**, **Render Web Service backend**. Both applications deploy from this repository's root so `shared/` and the npm workspace lockfile are available. The supplied files prepare deployment; they do not create accounts or imply a public deployment has succeeded.

## Verified monorepo layout

The root `package.json` declares two npm workspaces: `client` and `server`. `shared/` is a TypeScript source directory, **not a separately published package or third workspace**. It requires no separate install or publish step.

`server/tsconfig.json` includes `../shared/**/*.ts`, with `rootDir: ".."` and `outDir: "dist"`. The build emits `server/dist/server/index.js` and `server/dist/shared/{types,urls}.js`. The server start script runs from the `server/` workspace, so its relative entry point `dist/server/index.js` is correct. Runtime uses compiled JavaScript and does not require tsx or ts-node. The client imports `shared/` directly and does not need the backend build first.

Keep the **repository root** on both hosts: Root Directory empty on Render and `./` on Vercel. Selecting `server/` on Render hides the parent shared source and root lockfile. [Render monorepo documentation](https://render.com/docs/monorepo-support)

## 1. Push to your GitHub repository

This checkout already has Git initialized on `main`, with no commits or remote at inspection time. Create an empty GitHub repository named `undercover` in your account, without an initial README, license, or `.gitignore`. From PowerShell, after replacing `YOUR_ACCOUNT`:

```powershell
Set-Location 'C:\Users\danee\OneDrive\Desktop\Undercover'
git status --short
git add .
git diff --cached --name-only
git commit -m "Prepare UNDERCOVER for Render and Vercel deployment"
git remote add origin https://github.com/YOUR_ACCOUNT/undercover.git
git push -u origin main
```

Replace `YOUR_ACCOUNT`. Do not commit `.env` files or any hosting credentials. `.gitignore` already excludes them. `package-lock.json` must be committed. If using an existing repository, retain its history and remote configuration. GitHub Actions runs type checks, game/socket tests, and both builds on pushes and pull requests.

Review the staged file list before the commit. It must include `shared/`, both workspace manifests, the root lockfile, and the hosting files. It must exclude real `.env*` files, `.npmrc`, private key files, `node_modules`, generated `dist`, and browser reports. Only `.env.example` templates are retained. If Git asks for your identity, configure your own name and email before retrying the commit. No force push is needed.

This game requires no application API secrets. Hosting/GitHub credentials belong in the services' account connection flows. Every `VITE_*` value is public client configuration; never put a secret under that prefix. [Vite environment-variable documentation](https://vite.dev/guide/env-and-mode)

## 2. Reserve the frontend origin

Import the GitHub repository into Vercel and choose the desired project name, for example `undercover-yourname`. Its production origin will be similar to `https://undercover-yourname.vercel.app`; use the actual origin assigned to your project. Keep the **Root Directory at the repository root**. The root `vercel.json` supplies:

| Setting          | Value                     |
| ---------------- | ------------------------- |
| Framework        | Vite                      |
| Install command  | `npm ci --include=dev`    |
| Build command    | `npm run build -w client` |
| Output directory | `client/dist`             |
| Node version     | 24.x                      |

Keep Vercel Root Directory at `./`, Production Branch at `main`, and deploy only the static frontend; there is no frontend Start Command or Socket.IO serverless function. Both the root Node engine and Vercel project setting should be `24.x`. The explicit dev-dependency install makes TypeScript, Vite, Tailwind, and the React plugin available during a production build. [npm ci include/omit behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

Use an initial bootstrap deployment without `VITE_SERVER_URL` if needed to obtain the actual stable **Production** origin. Its page shows a server-configuration message and cannot create a game yet; it does not contact localhost. Copy the actual Production origin returned by Vercel instead of assuming it from the project name. Do not use a changing commit Preview URL. Then configure Render below, set the backend URL on Vercel, and redeploy the frontend. Ensure production access protection does not require your friends to sign in to Vercel.

## 3. Deploy the backend on Render

In Render, create a **Blueprint**, connect the same GitHub repository, and select `render.yaml`. It creates a Node Web Service with a free plan, health checks, and one instance. The plan can be changed in your own Render account if needed.

Set `CLIENT_ORIGINS` when the Blueprint prompts for it:

```text
https://undercover-yourname.vercel.app
```

Use the actual Vercel origin, **no trailing slash, path, or wildcard**. Multiple exact origins can be comma-separated, for example a custom domain and the production Vercel domain. Do not allow every `*.vercel.app` origin.

For a manual Render Web Service instead of a Blueprint, use:

| Setting           | Value                                             |
| ----------------- | ------------------------------------------------- |
| Runtime           | Node                                              |
| Root directory    | Leave empty (repository root)                     |
| Build command     | `npm ci --include=dev && npm run build -w server` |
| Start command     | `npm run start -w server`                         |
| Health check path | `/health`                                         |
| Instances         | **1**, autoscaling disabled                       |
| `NODE_VERSION`    | `24` (maintained patch of major 24)               |
| `NODE_ENV`        | `production`                                      |
| `TRUST_PROXY`     | `1` for Render's proxy                            |
| `CLIENT_ORIGINS`  | Exact HTTPS Vercel origin(s)                      |

Render provides `PORT` automatically. The backend binds to `process.env.PORT` on **0.0.0.0**, and fails startup in production if HTTPS frontend origins are missing. Leave Render's port setting alone.

The exact Render variables are:

```dotenv
NODE_ENV=production
NODE_VERSION=24
TRUST_PROXY=1
CLIENT_ORIGINS=https://YOUR_ACTUAL_FRONTEND.vercel.app
```

Do not copy `server/.env` to Render or set `VITE_SERVER_URL` there. `TRUST_PROXY=1` selects the immediate forwarding proxy's client address for room rate limits; keep `0` for direct local development. `CLIENT_ORIGINS` accepts comma-separated exact origins; HTTPS is required in production. Whitespace and a trailing slash are normalized, while paths, credentials, queries, and wildcards are rejected. The same allowlist controls polling CORS and WebSocket handshakes.

`render.yaml` keeps the repository root and includes build filters for `server/**`, `shared/**`, and root build/dependency files. Frontend-only and documentation changes will not restart Render with these filters. Lockfile/backend/shared changes still redeploy and lose active rooms. For manual services, add the same included paths under Build Filters. Keep one region and one instance. [Render build filters](https://render.com/docs/blueprint-spec#buildfilter)

Copy the generated public backend URL, for example `https://undercover-server-xxxx.onrender.com`. Visit `https://<actual-backend>/health`. It must return HTTP 200 with:

```json
{ "status": "ok", "service": "undercover", "storage": "in-memory" }
```

Socket.IO accepts both polling and WebSocket upgrades on `/socket.io/`. Use the **HTTPS base URL** in the client, without a `/socket.io` suffix. Socket.IO negotiates secure WebSockets automatically from HTTPS. Render supports public WebSockets; its guidance requires WSS for public connections. [Render WebSocket documentation](https://render.com/docs/websocket)

## 4. Connect and deploy the Vercel frontend

In the Vercel project's environment variables, set for Production:

```text
VITE_SERVER_URL=https://undercover-server-xxxx.onrender.com
```

Use your actual backend URL, not this example. It is public configuration, not a secret. Redeploy after changing it: Vite embeds the value at build time. Choose Node 24.x in Vercel's project settings. The static frontend has no serverless Socket.IO handler; its persistent connection goes directly to Render.

Use only the bare HTTPS origin: no `/socket.io` suffix, namespace, credentials, query, or internal port. The shared URL validator catches paths that would otherwise select the wrong Socket.IO namespace. Socket.IO derives WSS from the HTTPS URL; do not use `ws://` or `wss://` as `VITE_SERVER_URL`. Render terminates public TLS and forwards to the internal HTTP port.

Set the variable for Preview too only if you intend to use previews. Each preview origin must be explicitly added to `CLIENT_ORIGINS` on Render, or use a fixed preview domain and add that exact origin. Otherwise the backend correctly rejects the preview connection. Production and preview clients using the same backend share its room namespace.

Confirm the final Vercel production origin matches `CLIENT_ORIGINS`. If changing domains, update Render's allowlist, then redeploy/restart it outside active games.

The Vercel configuration includes SPA routing and headers. Keep `vercel.json` in the selected root. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel project configuration](https://vercel.com/docs/project-configuration).

## 5. Verify public multiplayer before calling deployment successful

1. Open the actual backend `/health` URL over HTTPS. Confirm HTTP 200.
2. Open the actual public Vercel URL without a hosting sign-in requirement. Desktop should show **ALL SYSTEMS GO**; phones show the connected dot and no reconnect banner. If the backend is waking, the page shows a connection message and automatically retries.
3. Player A creates a room. Players B and C open the same public frontend on different devices and networks (for example home Wi-Fi and mobile data).
4. B joins using the code; C uses the invitation link. All three player lists must synchronize.
5. Start and play a complete game: private reveal → three clues → discussion → secret votes → verdict → Imposter guess → winner → play again.
6. Refresh B during a clue round. The same identity, role, and game must return within the 60-second grace period.
7. Inspect the Imposter client's Socket.IO messages in developer tools: no server-provided secret word or private agent payload must appear. Check that vote choices/totals are hidden until the verdict.
8. Test both a phone and a laptop. Follow the full [three-window procedure](README.md#three-window-manual-acceptance-test) for ties, alternate winners, and disconnects.

9. Inspect browser Network tools: connections must go to the actual Render `/socket.io/` endpoint, with no localhost requests or mixed-content errors. A successful WebSocket upgrade uses WSS/HTTP 101 when the network supports it; polling fallback can still work if a network blocks upgrades.
10. Confirm Render has one instance and one process, and all frontends point to the same backend URL. Confirm a frontend-only push does not restart Render when the supplied filters are enabled.
11. Outside an active party, perform a controlled backend restart. Existing rooms should be lost, clients should report the expired/missing room, and a fresh room should work.

These checks require your actual hosting accounts and public endpoints. A local build or health check alone does not verify internet deployment.

## Production URL order

1. Push the root monorepo to GitHub.
2. Bootstrap the Vercel frontend and copy its actual stable Production HTTPS origin.
3. Deploy Render with that origin in `CLIENT_ORIGINS`. Copy its actual HTTPS backend origin and check `/health`.
4. Set Vercel Production `VITE_SERVER_URL` to the backend origin and redeploy the frontend.
5. Recheck both final URLs and run every public acceptance check above.

## Local predeployment verification

From the repository root with Node 24.x:

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run test:deployment
npm run test:e2e
npm audit
```

`test:deployment` builds both production applications and checks the emitted frontend/shared/server artifacts. It starts the compiled backend using the same arguments and working directory as the workspace start command, checks health and polling/WebSocket origin restrictions, joins three clients, assigns private roles, and restores a session. The HTTPS origins in this local test are harness inputs; it does not test public TLS or any hosted endpoint.

The browser tests run against local services and do not replace the public checks. A clean client build can run before the server build because it reads shared TypeScript directly. The root install must include dev dependencies: both production builds use TypeScript and the client build uses Vite.

## One server instance is required

Keep **one Render instance**, **one Node process**, and the **same `VITE_SERVER_URL` for every player**. Do not use PM2 cluster mode, Node cluster, multiple regions, multiple Render services behind a load balancer, or horizontal autoscaling. Room state lives in process-local Maps. With one instance, all device connections share the same room namespace. Render can send reconnects to different instances when multiple instances exist, so increasing instance count would break this architecture. [Render connection routing](https://render.com/docs/websocket#client-side-reconnects)

This scope deliberately excludes an external room store or Socket.IO adapter. Scaling across processes would require both shared game state and coordinated events/timers; sticky sessions alone would not make it correct.

## Room loss and sleep behavior

**Active rooms, roles, votes, and session credentials are lost whenever the backend restarts, crashes, sleeps with process replacement, or is redeployed.** There is no database or recovery log. On a new process, a reconnect reports that the room no longer exists and the player can create a fresh room. Avoid deploying during a party.

Transient network disconnection preserves a seat for 60 seconds while the process is alive. Timers continue server-side; refreshing never resets a phase. Once the grace period expires, host transfer and forfeiture rules apply. Empty rooms expire after ten minutes. If every participant permanently leaves a lobby, it is deleted sooner.

The frontend explains that the backend may take about a minute to wake and uses automatic reconnect backoff. Actual wake time varies; no synthetic bot, fake lobby, or local game substitutes for the backend.

## Troubleshooting

| Symptom                                 | Check                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Server not configured”                 | Set `VITE_SERVER_URL` to the HTTPS Render base URL and rebuild the Vercel deployment.                                                                         |
| Connecting indefinitely                 | Check Render logs and `/health`, exact `CLIENT_ORIGINS`, browser origin, HTTPS URLs, and deployment protection settings. Wait for a sleeping service to wake. |
| Room exists for A but not B             | All players must use the same backend URL and exactly one backend instance/process. Also check for a backend restart.                                         |
| Session replaced in another tab         | A browser storage profile shares a player token. Use separate profiles/browsers/devices for multiple players.                                                 |
| Room not found after redeploy           | Expected with in-memory storage. Create a new room.                                                                                                           |
| Build cannot find `shared`              | Deploy from the repository root, rather than `client/` or `server/`, using the supplied commands.                                                             |
| Previews fail but production works      | Add the exact preview origin to the allowlist or use a stable preview domain.                                                                                 |
| Local Vite build preview cannot connect | The production build requires an HTTPS `VITE_SERVER_URL`; use `npm run dev` for a local HTTP backend.                                                         |
| Rate limit under a reverse proxy        | Use `TRUST_PROXY=1` on Render, `0` locally; only trust the actual number of forwarding proxies.                                                               |

Blueprint field reference: [Render Blueprint specification](https://render.com/docs/blueprint-spec).
