# Backend Setup: Claude Assistant (subscription auth)

This backend gives Stoa an AI assistant powered by **your own Claude
subscription** — no billed API key, no per-message Anthropic charge. It uses
the Claude Agent SDK, which reuses the Claude Code login on your machine.

> **Scope:** This is permitted only for a personal project you run yourself.
> Anthropic's usage policy does **not** allow deploying an app that offers
> claude.ai login to other users. If Stoa ever becomes multi-user or
> hosted, switch to API-key auth. Keep this backend local.

## Architecture

- **Express.js** — HTTP server (`server.js`)
- **MongoDB** — stores conversation history for the UI
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — talks to Claude on
  your subscription; resumes context per conversation via a session id

## One-time setup

### 1. Install dependencies

```bash
pnpm install      # or: npm install
```

### 2. Log in to Claude (subscription auth)

The Agent SDK authenticates through Claude Code's login on this machine. If you
already use Claude Code here, you're done — it reuses that login. Otherwise log
in once:

```bash
npx @anthropic-ai/claude-agent-sdk
```

and complete the browser login with your Pro/Max account. There is **no API key
to paste** and nothing about auth goes in `.env`.

- Auth draws from your existing plan limits (the separate Agent SDK credit was
  paused June 15 2026, so there is no extra bucket right now).
- If a turn fails with an auth error, your Claude Code login has expired — log
  in again with the command above.

### 3. Set up MongoDB

Only one variable goes in `.env`:

#### MONGODB_URI
- **What it is:** connection string to your MongoDB database
- **Where to get it (free tier):**
  1. Go to https://www.mongodb.com/cloud/atlas
  2. Sign up (free), create an **M0 free** cluster
  3. Click **Connect → Drivers**, copy the connection string
  4. Replace `<password>` with your database user's password
  5. Put `stoa` as the database name
- **Where it goes:** `.env`, the `MONGODB_URI=` line
- **Example:** `mongodb+srv://user:pass@cluster0.abc.mongodb.net/stoa?retryWrites=true&w=majority`

Then:

```bash
cp .env.example .env   # then paste your MONGODB_URI into .env
```

`PORT` is optional (defaults to `3001`).

## Running it

There are two modes. Use dev at your desk; use the built app when you want it
on your phone.

### Desktop dev (live reload)

Two terminals:

```bash
pnpm run server    # Express + assistant on :3001  -> "Server running on port 3001"
pnpm run dev       # Vite frontend on :5173 (existing command)
```

The frontend calls the backend cross-origin; CORS is enabled on the server so
this just works. Nothing to configure.

### Phone access over Tailscale (built app)

The idea: build the frontend once, let the backend serve it, and expose that
one port through a private [Tailscale](https://tailscale.com) tunnel. Your
phone reaches it; your Claude login never leaves this machine; no one else can
see it. You're still the only user, so this stays inside the subscription-auth
scope.

```bash
pnpm run build     # produces dist/  (the backend auto-serves it if present)
pnpm run server    # serves the app AND /api/assist on :3001
```

Then, one time:

1. Install Tailscale on this machine and on your phone; sign both into the
   same account. (https://tailscale.com/download)
2. Expose the port over the tunnel's HTTPS:
   ```bash
   tailscale serve --bg 3001
   tailscale serve status      # prints your https://<machine>.<tailnet>.ts.net URL
   ```
   (Command syntax shifts between Tailscale versions — if `serve` complains,
   check `tailscale serve --help`.)
3. On your phone (Tailscale connected), open that `https://…ts.net` URL. Because
   it's real HTTPS, the PWA installs to your home screen and works offline for
   the non-assistant parts.

The assistant only answers while `pnpm run server` is running on this machine —
the tunnel just forwards to it; it isn't a cloud host. If the phone can load the
app but the assistant errors, this machine is asleep or the server stopped.

Why not just cloud-host it? Because that would put your personal Claude login on
a server, which is both sketchy to operate and outside what subscription auth is
for. The tunnel keeps the login here and only your devices in.

## API endpoint

### POST /api/assist

```json
// request
{ "userId": "me", "conversationId": null, "message": "What should I focus on today?" }

// response
{ "conversationId": "<mongo id>", "message": "…Claude's reply…" }
```

Pass `conversationId: null` to start a new thread; pass the returned id back on
later messages to continue it (the backend resumes the Agent SDK session for
that thread, so Claude keeps context).

## Frontend integration

Use `askAssistant` from [src/lib/api.js](src/lib/api.js):

```jsx
import { askAssistant } from '../lib/api.js';

const result = await askAssistant('Help me plan my day', {
  userId: 'me',
  conversationId: null, // or a saved id to continue a thread
});
console.log(result.message);
```

## How the assistant is configured (`server.js`)

- **Model:** `claude-opus-4-8` (change the `model` field in `runTurn` if your
  plan doesn't include it).
- **System prompt:** a life-tracking assistant persona (not the coding preset).
- **No tools:** `allowedTools: []`, `maxTurns: 1` — it just replies; it does not
  touch your files. If you later want it to read your tracker data, add tools
  and a `cwd` here.
- **Isolated config:** `settingSources: []` so it won't inherit your global
  Claude Code skills / `CLAUDE.md`.

## Troubleshooting

- **`Cannot find module '@anthropic-ai/claude-agent-sdk'`** → run `pnpm install`.
- **Auth / login errors on a turn** → re-run `npx @anthropic-ai/claude-agent-sdk`
  and log in again.
- **`Missing required environment variable: MONGODB_URI`** → `.env` has no
  `MONGODB_URI`, or it's empty.
- **Can't connect to MongoDB** → check the URI, and whitelist your IP in Atlas
  (Network Access → add your IP, or `0.0.0.0/0` for local dev).
- **Frontend can't reach backend** → confirm the server is on :3001 and
  `VITE_API_URL` (if set) matches.

## Why local-only

The SDK logs in as *you*. That token belongs on your machine, not a deployed
server, and Anthropic's policy reserves subscription auth for your own
projects. For a real deployment you'd swap `runTurn` to call the Messages API
with an `ANTHROPIC_API_KEY` instead — same `/api/assist` shape, so the frontend
wouldn't change.
