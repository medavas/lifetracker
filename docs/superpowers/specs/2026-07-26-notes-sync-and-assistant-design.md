# Design: Cross-device note sync + desktop Claude assistant

**Date:** 2026-07-26
**Status:** Approved (design), pending spec review
**Owner:** Ryan (single user)

## Goal

Make lifetracker notes sync between phone and desktop **independently of the
desktop**, so notes reconcile even when the desktop is off/asleep. Keep the
Claude assistant, but accept it working **only while the desktop is up**
(subscription auth cannot live on a server).

Two features with opposite hosting constraints, deliberately kept separate:
- **Notes sync** — must be always-on and desktop-independent.
- **Assistant** — must run on the desktop (subscription login), reachable via a
  private Tailscale tunnel, available only when the desktop is awake.

## Non-goals (YAGNI)

Realtime sync; delta/`since` cursors (push-all is fine at personal scale);
multi-user accounts; syncing the assistant chat transcript across devices;
tombstone garbage collection; any conflict-resolution UI.

## Architecture

Three pieces, each hosted where its constraints force it:

| Piece | Runs on | Availability | Holds |
|---|---|---|---|
| **PWA frontend** (existing app) | Always-on static host (e.g. Cloudflare Pages / Netlify, free) | Always | nothing; static code |
| **Sync API** (new, small Express) | Always-on cloud host + MongoDB Atlas | Always | the notes (authority) |
| **Assistant server** (existing `server.js`) | Desktop, via Tailscale `serve` | Only when desktop is up | nothing durable |

Notes never depend on the desktop: frontend and sync API are both always-on.
The Tailscale tunnel now serves **only** the assistant.

### Auth model — single pasted token

Single user, private. Auth is **one secret token**, not a login system:

- The token is the expected value in the sync API's env (`SYNC_TOKEN`).
- It is **never baked into the frontend build** (the frontend is public; a baked
  secret would leak). Instead the user pastes it once per device into an in-app
  Settings field; it is stored in that device's `localStorage`
  (`lifetracker.syncToken`) and sent as `Authorization: Bearer <token>` on every
  sync request.
- Requests with a missing/wrong token get `401`.

## Sync mechanism

**Per-entity last-write-wins (LWW) + soft-delete tombstones.**

### Entities

The synced records are the store's three entity kinds: `item`, `note`, `log`.
Each carries `id`, `updatedAt` (ms epoch), and nullable `deletedAt`. `points` is
**not** synced — see below.

### Endpoint

`POST /sync` (token-gated) does both directions in one round trip.

**Request:**
```json
{
  "entities": [
    { "kind": "item", "id": "…", "updatedAt": 1690000000000, "deletedAt": null, "data": { /* full item */ } },
    { "kind": "note", "id": "…", "updatedAt": 1690000000001, "deletedAt": 1690000009999, "data": { /* full note */ } },
    { "kind": "log",  "id": "…", "updatedAt": 1690000000002, "deletedAt": null, "data": { /* full log */ } }
  ]
}
```
**v1: the client sends its full entity set every sync** — the dataset is small
and delta/`since` cursors are a non-goal. (The array shows a few kinds for
illustration; a real request carries every item/note/log.)

**Server behavior:** for each incoming entity, upsert into Mongo iff
`incoming.updatedAt > stored.updatedAt` (or no stored record). `deletedAt` is a
normal field; newest `updatedAt` wins whether it is a delete or an edit.

**Response:**
```json
{ "entities": [ /* full authoritative set, including tombstoned records */ ], "serverTime": 1690000000003 }
```

**Client behavior:** apply the returned entities into the local store using the
**same merge function** (newest-`updatedAt`-wins per `id`) rather than blind
replacement — this preserves any edit made during the round trip. After merge,
recompute `points` and persist to IndexedDB.

### Shared merge module

The merge (newest-wins per `id`, tombstone respected, union of disjoint ids) is a
pure function in `src/lib/merge.js`, imported by **both** the client and the sync
API (same repo). One implementation, unit-tested once, used on both ends.

### Timing

- **Push:** on local mutation, debounced ~1–2s.
- **Pull:** on app load, on `window` focus, and on regaining connectivity
  (`online` event).
- Not realtime. "Syncs when you pick up the other device," which is the real
  usage pattern.

### Offline behavior

All writes hit local IndexedDB instantly (unchanged today). Sync failure (offline
or API unreachable) is swallowed and retried on the next focus/online event.
Nothing is lost or blocked; local-first is preserved.

## Store changes (in `src/lib/store.js`, `src/lib/storage.js`)

These are the targeted changes sync forces:

1. **Logs get `updatedAt` + nullable `deletedAt`** (items and notes already have
   `updatedAt`).
2. **Deletes become tombstones.** `deleteItem`, `deleteNote`, and the uncheck
   branches of `toggleDone` / `toggleHabitToday` (which currently drop logs) set
   `deletedAt = now()` and bump `updatedAt` instead of removing the record.
   Selectors (`selectAreaItems`, `selectItemNotes`, `selectJournal`, habit
   queries) filter out records with a non-null `deletedAt`.
3. **`points` becomes derived from logs**, not a mutable counter. A running total
   cannot be merged across devices. Define `computePoints(logs)` from
   `rewards.js`:
   - non-tombstoned `complete` logs × `POINTS.task`
   - non-tombstoned `habit-check` logs × `POINTS.habit`
   - distinct journal days (`kind === 'journal'`) × `POINTS.journal`

   After any log mutation and after every merge, `set({ points: computePoints(logs) })`.
   `points` stays in state (UI unchanged) but is only ever derived, so it is
   correct after a merge.

### Persistence layer (`storage.js`)

`idbStorage` stays as the offline cache (zustand `persist` keeps writing to
IndexedDB — instant, offline). A new `src/lib/sync.js` module owns the network:
debounced push, focus/online pull, applying merged results into the store,
surfacing auth/network errors. `storage.js`'s existing "DEPLOY / SYNC FLAG"
comment is realized here.

## Sync API (new — `server/sync/`)

Small Express app, deployable independently of the desktop.

- `POST /sync` as specified above.
- `GET /health` for the host's health check.
- Env: `MONGODB_URI`, `SYNC_TOKEN`, `PORT`.
- Mongo: one collection `entities`, documents keyed by `{ kind, id }`, fields
  `updatedAt`, `deletedAt`, `data`. (Single user, so no per-user partitioning.)
- No Claude. Never touches the desktop.

## Assistant server (existing `server.js`, refactored)

- **Drop the MongoDB dependency** — the assistant becomes stateless. There is now
  exactly one database (Mongo, notes only), not two.
- Conversation continuity uses the Agent SDK `sessionId`, stored in the synced
  store, so either device resumes the same desktop session.
- The chat transcript persists locally (and syncs like any other data only if we
  later choose to; out of scope now).
- Still runs on the desktop, subscription auth, exposed via `tailscale serve`.

## Configuration

| Var | Where | Secret? | Purpose |
|---|---|---|---|
| `VITE_SYNC_URL` | frontend build | no | always-on sync API base URL |
| `VITE_ASSIST_URL` | frontend build (or in-app setting) | no (tailnet-gated) | desktop assistant tunnel URL |
| `lifetracker.syncToken` | device `localStorage`, pasted in-app | yes | auth to the sync API |
| `MONGODB_URI` | sync API host | yes | Atlas connection |
| `SYNC_TOKEN` | sync API host | yes | expected token value |

## Error handling

- Bad/missing token → `401` → client shows "check your sync token" and stops
  retrying until the token changes.
- Network/API unreachable → silent, retried on next focus/online.
- Assistant unreachable → existing "desktop is asleep / server stopped" message;
  notes are unaffected.

## Testing

- **Unit:** `merge()` — newest-wins, tombstone precedence, union of disjoint ids;
  `computePoints()` — task/habit/journal totals incl. tombstone exclusion.
- **Integration:** two simulated clients → sync API → assert both converge to the
  same authoritative set (including a delete propagating).
- **Manual:** edit a note on the phone offline, reconnect, confirm it appears on
  the desktop and vice-versa; confirm a delete on one device removes it on the
  other.

## Build / deploy inputs (needed later, not for this spec)

1. **MongoDB Atlas** free M0 cluster → `MONGODB_URI`.
2. **Two hosts:** a static host for the frontend and an always-on host for the
   sync API (prefer one without cold starts, e.g. Fly.io / Railway over Render
   free). Accounts + deploy authorization are Ryan's.
3. **A sync token** — a strong random string; goes in the sync API env and gets
   pasted into each device.
4. **Desktop Claude login** for the assistant (likely already present).
5. **Tailscale** — already installed; both devices already on the tailnet.
