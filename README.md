# Stoa

Personal life dashboard — habits, journal, projects, finance, progress, everything in one place. Single user, local-first, built to eventually sync between desktop and phone.

## Stack

- **Vite + React** (JS), mobile-first PWA
- **zustand** for state, persisted to **IndexedDB** (`idb-keyval`)
- **@dnd-kit** for drag-drop reordering
- **HashRouter** so it runs as a static file anywhere (swap to BrowserRouter once a real server exists)
- No backend yet — that's deliberate. See the roadmap below.

## Run it

```bash
npm install
npm run dev      # local dev
npm run build    # production build → dist/
npm run preview  # serve the build locally
```

Install on phone: open the deployed URL (or `npm run preview` on your LAN) in the phone browser → "Add to Home Screen". It runs standalone with the app icon.

## Data model — 4 primitives

Everything is one of four things. Adding a new life-area is a config row in `src/data/areas.js`, not a new feature.

| Primitive | What it is | Where |
|---|---|---|
| **Area** | Static config: name, icon, gradient, kind, buckets, fuzzy keywords | `src/data/areas.js` |
| **Item** | Anything listed: task, habit, book, bill, quote | `store.items` |
| **Log** | A dated record: habit check-in, completion, journal-day | `store.logs` |
| **Note** | Journal entries and per-item notes | `store.notes` |

Rules encoded in the store (`src/lib/store.js`):

- **Unchecking ≠ archiving.** Uncheck returns an item to `open`. Archive is an explicit action in the item sheet; archived items are hidden but kept (soft delete). Hard delete requires a second confirming tap.
- **Points are reversible** — unchecking takes back what checking awarded.

## Rewards

`src/lib/rewards.js` — tune the constants freely:

- Complete an item: **+10** · habit check-in: **+5** · first journal entry of the day: **+15**
- Level = `√(points/100) + 1` (gently super-linear)
- Streaks are computed from logs, never stored — so they can't drift.

## 🚩 Deploy & sync roadmap (the flagged areas)

The app is a local-first shell **on purpose**. Everything below is the path to "on my phone, synced with desktop, behind a locked door." Work top to bottom.

### 1. Hosting the static app (can do today, free)

The `dist/` build is static files. GitHub Pages, Cloudflare Pages, or Netlify free tier all work. **Note: Heroku has had no free tier since Nov 2022** — don't default to it. This gets the app on your phone as a PWA, but data still lives per-device (no sync yet).

### 2. The API + database (the sync backend)

- **Swap point is one file:** `src/lib/storage.js`. It exposes `{ getItem, setItem, removeItem }`; implement the same interface against an API and nothing else changes.
- Express + **MongoDB Atlas M0** (free) with the IP allowlist locked down. Collections mirror the primitives: `items`, `logs`, `notes`, plus a `meta` doc for points.
- Sync strategy for one user on two devices: **last-write-wins on `updatedAt` per entity**, push on change, pull on app focus. Don't build CRDTs for yourself.
- A `server/` directory placeholder is stubbed in this repo with the auth notes below.

### 3. Auth (the locked door — rdeyo site)

- Single user → you don't need an accounts system. One of:
  - **WebAuthn/passkey** ("thumbprint access") — actually simpler than passwords for single-user, phone-native, phishing-proof. Preferred.
  - Or one **bcrypt**-hashed password + httpOnly session cookie + aggressive rate limiting.
- Non-negotiables when the API exists: HTTPS only, secrets in env vars (never in this repo), no real account numbers/credentials stored — nicknames and amounts only.

### 4. Hosting the API

Render free tier (spins down when idle — fine for one user), Fly.io, or Railway. Static frontend stays on Pages/Netlify; API is its own small service.

### Env template

`.env.example` is checked in; copy to `.env` when the backend lands. `.env` is gitignored.

## Where things live

```
src/
  data/areas.js        ← the area registry (add areas here)
  lib/store.js         ← state + actions (4 primitives)
  lib/storage.js       ← persistence adapter 🚩 sync swap point
  lib/rewards.js       ← points, levels, streaks
  lib/fuzzy.js         ← quick-capture area suggestion
  components/          ← nav, item list (dnd), sheets, ring, chart
  views/               ← Dashboard, AreasGrid, AreaView, Journal, Habits
server/                ← 🚩 placeholder: Express/Mongo/WebAuthn plan
```
