# UNDERCOVER

An original, real-time browser party game for 3–12 friends. One secret word. One convincing liar. Play on phones or laptops, in the same room or across the internet.

## Run locally

Use Node **24 LTS** and npm. From the repository root:

```sh
npm ci
```

Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`. In PowerShell:

```powershell
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

```sh
npm run dev
```

Open **http://localhost:5173**. The backend runs on port **3001**; health is **http://localhost:3001/health**. These addresses are development defaults. No accounts, database, API keys, paid services, or extensions are required.

To run each application in its own terminal:

```sh
npm run dev -w server
npm run dev -w client
```

For a production build and local backend process:

```sh
npm run build
npm start
```

`npm start` runs the compiled Express/Socket.IO backend. Serve `client/dist` with a static host; `npm run preview -w client` is a local build preview. Set `VITE_SERVER_URL` before building the client. The production client requires an HTTPS backend URL and does not silently fall back to localhost.

## Implemented

- Complete Classic Imposter: private role assignment, timed turns, clues, discussion, secret ballots, elimination, one restricted tie revote, final guesses, both victory paths, and replay in the same room.
- Six-character cryptographically generated codes, 3–12 players, case-insensitive unique nicknames, avatar colors, host permissions, pregame removal, copy code, and native share/copy invitation links.
- A host who also plays; settings for six categories or all categories and 20/30/45/60-second clue turns.
- 180 manually curated words across Food, Animals, Technology, Entertainment, Places, and Everyday objects.
- Server-issued 256-bit random player tokens stored in localStorage for refresh/reconnect. One current socket per player; a new tab safely supersedes the previous socket.
- A 60-second disconnect grace period, permanent-departure handling, host transfer, ten-minute empty-room expiry, heartbeat detection, and interval cleanup.
- Timestamp-based server deadlines, input limits, per-IP create/join limits, per-socket action limits, origin allowlisting, safe text rendering, and idempotent clue/vote retries.
- Responsive original interface, keyboard-accessible hold-to-reveal cards, locally bundled fonts, animated dossiers, countdowns, evidence history, voting progress, results, and reduced-motion support.
- Vercel configuration, Render Blueprint, environment examples, and GitHub Actions build/test workflow.

Double Agent and its word pairs are deliberately deferred. No bots, voice chat, accounts, leaderboards, payments, database, or AI APIs are included. Discussion happens in person or on a separate group call.

## Architecture

```text
client/                  React + TypeScript + Vite + Tailwind + Motion
  src/components/        Brand, UI primitives, settings, private role card
  src/pages/             Landing and room/game screens
  src/hooks/             Timestamp-based countdown
  src/store/             Zustand socket/session state
  src/styles/            Responsive design system
server/                  Node + Express + Socket.IO + TypeScript
  game/engine.ts         Transport-independent authoritative game state machine
  rooms/manager.ts       In-memory Maps, secure identity, reconnect and cleanup
  sockets/register.ts    Typed actions, authorization, limits, public/private delivery
  data/words.ts          Curated word bank
  utils/                 Validation, crypto shuffle, rate limiter
  tests/                 Vitest rules and concurrent socket tests
shared/types.ts          Phase definitions, sanitized snapshots, event contracts
e2e/                     Real-browser multiplayer tests
```

The server owns every phase transition, deadline, role, word, vote, and winner. The client sends intentions, never assignments or state replacements. A 250 ms scheduler advances expired deadlines; incoming actions also check deadlines so a late packet cannot beat the interval.

```text
LOBBY → ROLE_REVEAL → CLUE_ROUND → DISCUSSION → VOTING → VOTE_RESULTS
                         ↑                                  │
                         └── agent eliminated / second tie ─┤
                                    first tie → VOTING      │
                              Imposter eliminated → FINAL_GUESS
                                                → GAME_OVER → LOBBY
```

Roles use a crypto-backed Fisher–Yates shuffle. Turn order is shuffled independently of role assignment. Public snapshots are assembled from an explicit allowlist, not by serializing internal rooms. They contain no tokens, secret words, vote choices, or unrevealed role identities. Private snapshots go only to the current authenticated socket. The Imposter never receives a `word` property, including at game over. Agents can see the word again in results. Eliminated identities are revealed only with the verdict; the Imposter identity is shown at game over.

Clue and vote retries with the same value are harmless. Changing a locked submission is rejected. Text is normalized, stripped of control/markup characters, length-limited, and rendered as React text. An exact normalized secret word cannot be used as a clue. Final guesses ignore capitalization, spaces, and punctuation, but have no fuzzy matching or synonyms.

## Timing and disconnect rules

| Phase           | Duration / early transition                                |
| --------------- | ---------------------------------------------------------- |
| Role reveal     | 25 seconds, or everyone marks ready                        |
| Clue turn       | Host's 20/30/45/60 seconds; timeout records a skipped clue |
| Discussion      | 120 seconds; host may open voting early                    |
| Voting / revote | 30 seconds, or every active player votes                   |
| Vote results    | 6.5 seconds, then automatic transition                     |
| Final guess     | 30 seconds, or the Imposter submits one guess              |

Every active player can vote for another active eligible player. A revote narrows candidates to the tied suspects while all active players still vote. Zero ballots count as a tie among eligible candidates: one revote, then no elimination. Disconnected players keep their seat during the grace period, but timers continue. After grace expires, a departing Imposter forfeits to the agents; a regular departure can trigger the two-player Imposter victory. A pending final guess is preserved if another regular player departs. An eliminated host may still operate host controls. Voluntary leave is permanent immediately. Removed/expired tokens cannot resume a game.

localStorage holds only the session credential, never authoritative game state. One browser storage profile is one player. Use separate browser profiles, browsers, or devices to simulate friends. Protect the token like a room credential; do not share it or include it in URLs. The room code alone is an invitation, not an account identity.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:deployment
npm audit
```

Vitest includes deterministic phase/timer/tie/winner tests and real concurrent Socket.IO clients exercising a complete three-player game, refresh restoration, private role payloads, duplicate votes, host authorization, origin rejection, session replacement, removal, host transfer, and replay.

`npm run test:deployment` builds both production apps, validates the emitted shared/server/client files, and runs the compiled backend with production configuration. It verifies health, allowed/blocked origins for both polling and WebSockets, three-player role delivery, and session restoration. Run it from the repository root so both npm workspaces and shared sources are available. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact Render/Vercel settings and URL configuration order.

Run the real browser flow:

```sh
npm run test:e2e
```

Playwright launches three isolated browser storage contexts at desktop, phone, and tablet sizes, plays through the UI, refreshes a player during the game, votes, submits a final guess, and starts another game. It also checks a 320 px phone layout, rules, and room creation. It records screenshots in `test-results` and an HTML report in `playwright-report`. On Windows it uses installed Chrome when available. Otherwise install the test browser once:

```sh
npx playwright install chromium
```

On Linux CI, use `npx playwright install --with-deps chromium`. You can override the executable with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The browser test starts both development services, or uses them if already running.

## Three-window manual acceptance test

1. Start `npm run dev`. Open `http://localhost:5173` in three **independent storage profiles**: for example Chrome normal, Edge normal, and Firefox normal. Three ordinary Chrome windows share the same credential and will replace one another. Multiple incognito windows in the same browser may also share storage.
2. In A, choose **Create a room**, enter **Aster**, choose a category and timer, and create. The six-character code and one host card appear. Start is disabled with fewer than three players.
3. Copy the code. In B and C choose **Join a room**, enter **Billie** and **Casey**, and use that code. Alternatively open A's invitation link. All windows must show the same three players and A's host badge. Try a duplicate nickname or invalid code in another fresh profile to confirm a readable error.
4. Refresh B in the lobby. It must return as Billie with no duplicate player. A changes the clue timer and category; B and C see the changes. Only A can edit settings or remove players.
5. A selects **Start the game**. In each window, hold the role card with a pointer, touch, or the Space/Enter key. Exactly one player sees **YOU ARE THE IMPOSTER** and no word. Both agents see the same word. Release to hide it. In an agent's window, privately note the word for step 10.
6. Everyone selects **I know my assignment**. One player gets the clue input. Refresh the Imposter's browser within 60 seconds: the same player, role and game return. A role can be peeked at by holding the sidebar card.
7. Follow the displayed turn order and submit a different short clue in each window. Other players cannot submit out of turn. Every accepted clue must appear in all three evidence histories. On a later round, let a turn expire to check the automatic skipped clue.
8. After the third clue all windows enter discussion. A selects **Ready to point fingers**. All windows open private voting; a 30-second server deadline is displayed.
9. In each agent's window select the Imposter and **Lock in my vote**. The Imposter votes for either agent. A submitted vote is locked; the UI allows no second choice. Before all ballots are in, only the number submitted is shown. The verdict must show two votes for the Imposter and one for an agent.
10. After the automatic result delay, the Imposter receives the only final-guess input. Submit the exact word noted in step 5. All windows must announce an Imposter win. On a repeat game use a wrong guess, or let the final timer expire, to verify an agent win.
11. A selects **One more round**. The original code and same players remain. Start again; roles are independently randomized and prior clues/votes disappear.
12. Verify a tie on another game: A votes B, B votes C, C votes A. The first verdict opens one revote. Repeat the cycle. Nobody is eliminated and clue round 2 begins automatically.
13. Verify a regular elimination: both players other than one chosen agent vote for that agent; that agent votes for somebody else. With three players, the remaining two include the Imposter, so the Imposter wins. With four players, a regular elimination instead starts another clue round.
14. In the lobby, disconnect A for more than 60 seconds. A connected player becomes host. Reconnect within 60 seconds in a separate trial to verify that a temporary disconnect preserves the host and seat. Test pregame removal with a fourth profile if desired.
15. Repeat at phone size and on a real phone. Check hold/release secrecy, scrolling, inputs with the onscreen keyboard, vote cards, and share controls. A private clipboard may be unavailable on non-HTTPS network development URLs; the selectable code still works.

For public-internet acceptance, perform the same steps against the deployed Vercel URL with friends on separate networks, and verify `https://<backend>/health`. No shared Wi-Fi is required once deployed. Deployment is not claimed until that public test is performed.

## Deployment and operating limits

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub → Render + Vercel setup, exact variables, troubleshooting, and public verification. Use **one backend instance and one Node process**. All players must point to that same backend URL. Active rooms and tokens are **lost when the backend restarts or is redeployed**; this is intentional for the one-day, in-memory scope. A sleeping free backend may take time to wake; the client displays connection progress and retries automatically. A 500-room cap bounds process memory.

## Reference and originality

The requested [reference project](https://github.com/davenh99/imposter) was inspected for gameplay and architecture, including `api/lobby.go`, `api/api.go`, `main.go`, `ui/src/routes/GameRoom.tsx`, and `ui/src/config/api.ts`. It uses Go/chi, Gorilla WebSockets, in-memory lobbies, HTTP game controls, and a SolidJS/Vite frontend. The shared concept is a room code, a secret word, and a player bluffing without it. UNDERCOVER's TypeScript state machine, protocol, token model, voting/turn mechanics, branding, artwork, and UI were written independently. No reference source or assets are included.
