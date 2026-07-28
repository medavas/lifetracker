# Backend Setup: Sync API + Claude Assistant

Stoa has two independent backend pieces, plus the static frontend build. They
run separately, deploy separately, and fail separately:

1. **Sync API** (`server/sync/`) — always-on, syncs your notes/items/logs
   across devices. Meant to live on a cheap always-on host, so it works even
   when your desktop is asleep.
2. **Assistant server** (`server.js`, repo root) — the AI assistant, powered
   by **your own Claude subscription** (no billed API key, no per-message
   Anthropic charge). Only answers while this machine is up and the server is
   running; it is not meant to be cloud-hosted (see [Why the assistant stays
   local](#why-the-assistant-stays-local)).
3. **Frontend** — a static Vite build, hosted anywhere, pointed at both of the
   above via build-time env vars.

**In one sentence:** your notes sync whenever the sync API is reachable
(your desktop's state is irrelevant to that); the assistant only answers
while the desktop's `pnpm run server` is running.

> **Scope:** the assistant's subscription auth is permitted only for a
> personal project you run yourself. Anthropic's usage policy does **not**
> allow deploying an app that offers claude.ai login to other users. If Stoa
> ever becomes multi-user or hosted, switch the assistant to API-key auth.
> Keep that piece local. (The sync API has no Claude auth in it at all — it's
> just your data, gated by a bearer token — so it's fine to put it on a
> public host.)

## Architecture

- **Sync API** (`server/sync/index.js`) — Express + MongoDB. Stateless HTTP:
  each request carries the client's local entities, the server merges them
  (last-write-wins) and returns the merged set. No Claude, no sessions.
- **Assistant server** (`server.js`) — Express + the **Claude Agent SDK**
  (`@anthropic-ai/claude-agent-sdk`), which reuses the Claude Code login on
  this machine. It does not touch MongoDB or any other datastore — it's a
  stateless request/response proxy to Claude, with the conversation resumed
  client-side via a `sessionId` the frontend holds onto.
- **Frontend** — reads `VITE_SYNC_URL` and `VITE_ASSIST_URL` at build time
  (Vite bakes them into the bundle) to know where to send sync and assistant
  requests.

## One-time setup

### 1. Install dependencies

```bash
pnpm install      # or: npm install
```

### 2. Log in to Claude (subscription auth, for the assistant only)

The Agent SDK authenticates through Claude Code's login on this machine. If
you already use Claude Code here, you're done — it reuses that login.
Otherwise log in once:

```bash
npx @anthropic-ai/claude-agent-sdk
```

and complete the browser login with your Pro/Max account. There is **no API
key to paste** and nothing about auth goes in any `.env` file.

- Auth draws from your existing plan limits (the separate Agent SDK credit
  was paused June 15 2026, so there is no extra bucket right now).
- If a turn fails with an auth error, your Claude Code login has expired —
  log in again with the command above.
- This step only matters for the assistant server. The sync API needs no
  Claude auth at all.

### 3. Set up MongoDB (for the sync API only)

The assistant server no longer uses MongoDB (it dropped the old
conversation-history collection). Mongo is now purely the sync API's
datastore, configured in `server/sync/.env`, not the repo-root `.env`.

- **What it is:** connection string to your MongoDB database
- **Where to get it (free tier):**
  1. Go to https://www.mongodb.com/cloud/atlas
  2. Sign up (free), create an **M0 free** cluster
  3. Click **Connect → Drivers**, copy the connection string
  4. Replace `<password>` with your database user's password
  5. Put `stoa` as the database name
- **Where it goes:** `server/sync/.env`, the `MONGODB_URI=` line

```bash
cp server/sync/.env.example server/sync/.env
# then edit server/sync/.env: paste MONGODB_URI, set a real SYNC_TOKEN
```

`SYNC_TOKEN` is a bearer token you make up (a long random string) — it's the
only thing gating write/read access to your sync data. `PORT` defaults to
`4000` if unset.

### 4. Set up the repo-root `.env` (frontend + assistant)

```bash
cp .env.example .env
```

- `VITE_SYNC_URL` / `VITE_ASSIST_URL` — only needed for a real build (step
  c below); leave blank for local dev, where the frontend defaults to
  `http://localhost:3001` for the assistant and skips sync silently if
  `VITE_SYNC_URL` is unset.
- `PORT` — the assistant server's port, defaults to `3001`.

## Running it: the three targets

### (a) Sync API — always-on host

This is the one you want reachable 24/7, independent of your desktop, so
notes sync from your phone even when your computer is asleep.

```bash
pnpm run sync      # reads server/sync/.env -> "Sync API on :4000"
```

For real always-on availability, deploy this to a cheap/free always-on host
— Fly.io or Railway both have free tiers that work fine for a single-user
app. Set `MONGODB_URI`, `SYNC_TOKEN`, and `PORT` as that host's environment
variables (same values as `server/sync/.env`). Whatever URL the host gives
you (e.g. `https://stoa-sync.fly.dev`) is what goes into `VITE_SYNC_URL`
when you build the frontend.

Health check: `GET /health` → `{ ok: true }`, unauthenticated.

### (b) Assistant server — desktop only

```bash
pnpm run server    # Express + assistant on :3001 -> "Assistant server on :3001"
```

This one stays on your machine — it's the whole point of subscription auth
(see [Why the assistant stays local](#why-the-assistant-stays-local)). To
reach it from your phone, expose it over a private
[Tailscale](https://tailscale.com) tunnel:

1. Install Tailscale on this machine and your phone; sign both into the same
   account. (https://tailscale.com/download)
2. Expose the port over the tunnel's HTTPS:
   ```bash
   tailscale serve --bg 3001
   tailscale serve status      # prints your https://<machine>.<tailnet>.ts.net URL
   ```
   (Command syntax shifts between Tailscale versions — if `serve` complains,
   check `tailscale serve --help`.)
3. That `https://…ts.net` URL is what goes into `VITE_ASSIST_URL` when you
   build the frontend.

The assistant only answers while `pnpm run server` is running on this
machine — the tunnel just forwards to it, it isn't a cloud host. If the
assistant errors but sync still works, this machine is asleep or the server
stopped; that's expected and doesn't affect sync.

For local dev (no tunnel), just run both dev servers:

```bash
pnpm run server    # assistant on :3001
pnpm run dev       # Vite frontend on :5173
```

CORS is enabled on the server so the frontend can call it cross-origin with
no extra config.

### (c) Frontend — static build

```bash
pnpm run build     # produces dist/
```

Bake in the two URLs from targets (a) and (b) at build time, e.g.:

```bash
VITE_SYNC_URL=https://stoa-sync.fly.dev VITE_ASSIST_URL=https://brutus.<tailnet>.ts.net pnpm run build
```

or set them in `.env` before building. Host `dist/` anywhere static (the
assistant server will also serve it if you drop `dist/` next to `server.js`
and run `pnpm run server`, but that's optional — the three targets are
independently deployable).

### (d) The sync token — never baked into the build

`SYNC_TOKEN` lives only in `server/sync/.env` (server-side) and in each
device's browser storage (client-side) — it is never a `VITE_*` build-time
var and never ships in the frontend bundle. To link a new device:

1. Open the app, go to the **Sync** page (gear icon in the bottom nav).
2. Paste the same `SYNC_TOKEN` value you set in `server/sync/.env`.
3. Save — it syncs immediately and on every local change (debounced) plus
   on focus/reconnect after that.

Anyone without the token can't read or write your sync data (`401` on every
`/sync` call); anyone with it can, so treat it like a password.

## API endpoints

### Sync API — `POST /sync` (bearer auth)

```json
// request
{ "entities": [ /* local items/notes/logs, each with an updatedAt */ ] }

// response
{ "entities": [ /* merged, last-write-wins */ ], "serverTime": 1690000000000 }
```

Client-side, this is driven by `syncNow()` / `startSync()` in
[src/lib/sync.js](src/lib/sync.js) — debounced push on local change, pull on
focus/online, silently a no-op if no token or `VITE_SYNC_URL` is unset.

### Assistant server — `POST /api/assist`

```json
// request
{ "message": "What should I focus on today?", "sessionId": null }

// response
{ "sessionId": "<agent sdk session id>", "message": "…Claude's reply…" }
```

Pass `sessionId: null` to start a new thread; pass the returned id back on
later messages to continue it (the Agent SDK resumes that session
server-side, so Claude keeps context — no database involved).

Client-side, use `askAssistant` from [src/lib/api.js](src/lib/api.js):

```jsx
import { askAssistant } from '../lib/api.js'

const result = await askAssistant('Help me plan my day', { sessionId: null })
console.log(result.message)
```

## How the assistant is configured (`server.js`)

- **Model:** `claude-opus-4-8` (change the `model` field in `runTurn` if your
  plan doesn't include it).
- **System prompt:** a life-tracking assistant persona (not the coding
  preset).
- **No tools:** `allowedTools: []`, `maxTurns: 1` — it just replies; it does
  not touch your files or any database. If you later want it to read your
  tracker data, add tools and a `cwd` here.
- **Isolated config:** `settingSources: []` so it won't inherit your global
  Claude Code skills / `CLAUDE.md`.

## Troubleshooting

- **`Cannot find module '@anthropic-ai/claude-agent-sdk'`** → run `pnpm
  install`.
- **Auth / login errors on an assistant turn** → re-run `npx
  @anthropic-ai/claude-agent-sdk` and log in again.
- **`Sync API needs MONGODB_URI and SYNC_TOKEN`** on `pnpm run sync` →
  `server/sync/.env` is missing or incomplete; it does not fall back to the
  repo-root `.env`.
- **Can't connect to MongoDB** → check `MONGODB_URI` in `server/sync/.env`,
  and whitelist your IP (or the host's egress IP, once deployed) in Atlas
  (Network Access → add IP, or `0.0.0.0/0` for local dev).
- **Sync page says "Check your sync token"** → the token pasted on that
  device doesn't match `SYNC_TOKEN` in `server/sync/.env` (or on the deployed
  sync host).
- **Sync page says "Offline — will retry"** → the sync API isn't reachable
  (host asleep/down, `VITE_SYNC_URL` wrong, or no network) — it'll retry on
  the next focus/reconnect.
- **Frontend can't reach the assistant** → confirm `pnpm run server` is
  running and `VITE_ASSIST_URL` (or `localhost:3001` in dev) is correct.
- **Frontend can't reach sync** → confirm the sync host is up (`GET
  /health`) and `VITE_SYNC_URL` is correct; this is independent of whether
  the assistant/desktop is up.

## Why the assistant stays local

The Agent SDK logs in as *you*. That token belongs on your machine, not a
deployed server, and Anthropic's policy reserves subscription auth for your
own projects. For a real deployment you'd swap `runTurn` in `server.js` to
call the Messages API with an `ANTHROPIC_API_KEY` instead — same
`/api/assist` shape, so the frontend wouldn't change. The sync API has no
such restriction, since it never touches Claude — that's exactly why it's
the piece meant to be cloud-hosted.
