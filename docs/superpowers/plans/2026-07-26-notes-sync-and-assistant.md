# Cross-device Note Sync + Stateless Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync lifetracker's notes/items/logs between phone and desktop through an always-on Express + Mongo sync API (independent of the desktop), while the Claude assistant runs on the desktop only when it's up.

**Architecture:** Client stays local-first (IndexedDB via zustand `persist`). A new pure `merge()` (per-entity newest-`updatedAt`-wins, soft-delete tombstones) is shared by the client and a small always-on sync API. The client pushes on change (debounced) and pulls on focus/online. Points become derived from logs so they never need merging. The existing assistant server drops its Mongo dependency and becomes stateless.

**Tech Stack:** React 19 + Vite 8, zustand 5 (+persist), idb-keyval, Express 4, Mongoose 8, MongoDB Atlas, `@anthropic-ai/claude-agent-sdk`; tests with Vitest + supertest + mongodb-memory-server + fake-indexeddb.

## Global Constraints

- Repo: `lifetracker`; work on branch `notes-sync` (already created and checked out).
- Single user, private. Auth is ONE token via `Authorization: Bearer <token>`; token compared against env `SYNC_TOKEN`; never baked into the frontend build.
- ESM everywhere (`package.json` has `"type": "module"`). Use `import`/`export`, `.js` extensions on relative imports in server code.
- `merge.js` and `rewards.js` must stay pure (no `import.meta`, no `idb`, no `window`) so Node server code can import them.
- Entity shape (canonical, used everywhere): `{ kind: 'item' | 'note' | 'log', id: string, updatedAt: number, deletedAt: number | null, data: object }`.
- Timestamps are `Date.now()` ms integers. `updatedAt` bumps on every create/edit/delete.
- Point values (from `src/lib/rewards.js`, do not change): `task: 10`, `habit: 5`, `journal: 15`.
- Sync v1 sends the FULL entity set each call (no delta/`since` cursors — non-goal).
- YAGNI: no realtime, no multi-user, no chat-transcript sync, no tombstone GC.

---

## Task 1: Test runner setup (Vitest)

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.js`
- Create: `test/setup.js`
- Create: `src/lib/__tests__/smoke.test.js`

**Interfaces:**
- Produces: `pnpm test` runs Vitest once; Node environment; `fake-indexeddb/auto` preloaded so `indexedDB` exists for store tests.

- [ ] **Step 1: Add dev deps and scripts**

Edit `package.json` — add to `devDependencies`:
```json
"vitest": "^2.1.8",
"supertest": "^7.0.0",
"mongodb-memory-server": "^10.1.2",
"fake-indexeddb": "^6.0.0"
```
Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: exits 0, lockfile updates.

- [ ] **Step 3: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
  },
})
```

- [ ] **Step 4: Write `test/setup.js`**

```js
// Gives Node an in-memory IndexedDB so the zustand persist layer works in tests.
import 'fake-indexeddb/auto'
```

- [ ] **Step 5: Write a smoke test `src/lib/__tests__/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest'

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run**

Run: `pnpm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.js test/setup.js src/lib/__tests__/smoke.test.js
git commit -m "test: add vitest with fake-indexeddb setup"
```

---

## Task 2: `computePoints(logs)` — derive points from logs

**Files:**
- Modify: `src/lib/rewards.js`
- Test: `src/lib/__tests__/rewards.test.js`

**Interfaces:**
- Consumes: `POINTS` (already in `rewards.js`).
- Produces: `computePoints(logs: Log[]) => number`. A `Log` is `{ id, itemId, areaId, kind, date, createdAt, updatedAt?, deletedAt? }`. `kind` ∈ `'complete' | 'habit-check' | 'journal'`. Tombstoned logs (`deletedAt` truthy) are ignored. Journal points count DISTINCT `date` values once each.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { computePoints } from '../rewards.js'

const log = (over) => ({ id: Math.random().toString(), itemId: 'i', areaId: 'a', date: '2026-07-26', createdAt: 1, updatedAt: 1, deletedAt: null, ...over })

describe('computePoints', () => {
  it('is 0 for no logs', () => {
    expect(computePoints([])).toBe(0)
  })
  it('scores completes and habit-checks', () => {
    expect(computePoints([log({ kind: 'complete' }), log({ kind: 'habit-check' })])).toBe(15) // 10 + 5
  })
  it('counts each journal day once', () => {
    const logs = [
      log({ kind: 'journal', date: '2026-07-26' }),
      log({ kind: 'journal', date: '2026-07-26' }),
      log({ kind: 'journal', date: '2026-07-27' }),
    ]
    expect(computePoints(logs)).toBe(30) // two distinct days * 15
  })
  it('ignores tombstoned logs', () => {
    expect(computePoints([log({ kind: 'complete', deletedAt: 5 })])).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: FAIL — `computePoints is not a function`.

- [ ] **Step 3: Implement in `src/lib/rewards.js`** (append)

```js
/**
 * Points are DERIVED from logs so they never need cross-device merging.
 * complete → POINTS.task, habit-check → POINTS.habit, and each distinct
 * journal day → POINTS.journal once. Tombstoned logs don't count.
 */
export function computePoints(logs) {
  const live = logs.filter((l) => !l.deletedAt)
  let pts = 0
  for (const l of live) {
    if (l.kind === 'complete') pts += POINTS.task
    else if (l.kind === 'habit-check') pts += POINTS.habit
  }
  const journalDays = new Set(live.filter((l) => l.kind === 'journal').map((l) => l.date))
  return pts + journalDays.size * POINTS.journal
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rewards.js src/lib/__tests__/rewards.test.js
git commit -m "feat(rewards): derive points from logs"
```

---

## Task 3: Merge engine + entity serialization (pure, shared)

**Files:**
- Create: `src/lib/merge.js`
- Test: `src/lib/__tests__/merge.test.js`

**Interfaces:**
- Produces:
  - `toEntities({ items, notes, logs }) => Entity[]` — flattens the three arrays into canonical entities (`data` is the original object).
  - `fromEntities(entities) => { items, notes, logs }` — regroups by `kind`, returning the `data` objects (tombstones INCLUDED — filtering is the store/selectors' job).
  - `merge(a, b) => Entity[]` — union keyed by `` `${kind}:${id}` ``; for a collision the higher `updatedAt` wins (ties: `b` wins).
- Entity shape per Global Constraints. Pure module — no imports from `idb`/`window`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { toEntities, fromEntities, merge } from '../merge.js'

const item = (over) => ({ id: 'i1', areaId: 'a', title: 't', status: 'open', updatedAt: 10, deletedAt: null, ...over })

describe('toEntities/fromEntities', () => {
  it('round-trips items/notes/logs', () => {
    const state = {
      items: [item()],
      notes: [{ id: 'n1', areaId: 'a', text: 'x', updatedAt: 5, deletedAt: null }],
      logs: [{ id: 'l1', itemId: 'i1', kind: 'complete', date: '2026-07-26', updatedAt: 7, deletedAt: null }],
    }
    const ents = toEntities(state)
    expect(ents).toHaveLength(3)
    expect(ents.find((e) => e.kind === 'item').id).toBe('i1')
    const back = fromEntities(ents)
    expect(back.items[0].title).toBe('t')
    expect(back.logs[0].kind).toBe('complete')
  })
})

describe('merge', () => {
  it('keeps the newer updatedAt per kind:id', () => {
    const a = [{ kind: 'item', id: 'i1', updatedAt: 10, deletedAt: null, data: item({ title: 'old' }) }]
    const b = [{ kind: 'item', id: 'i1', updatedAt: 20, deletedAt: null, data: item({ title: 'new', updatedAt: 20 }) }]
    const m = merge(a, b)
    expect(m).toHaveLength(1)
    expect(m[0].data.title).toBe('new')
  })
  it('a newer tombstone beats an older edit', () => {
    const a = [{ kind: 'note', id: 'n1', updatedAt: 30, deletedAt: null, data: { id: 'n1', text: 'edit' } }]
    const b = [{ kind: 'note', id: 'n1', updatedAt: 40, deletedAt: 40, data: { id: 'n1', text: 'edit' } }]
    expect(merge(a, b)[0].deletedAt).toBe(40)
  })
  it('unions disjoint ids', () => {
    const a = [{ kind: 'item', id: 'i1', updatedAt: 1, deletedAt: null, data: {} }]
    const b = [{ kind: 'item', id: 'i2', updatedAt: 1, deletedAt: null, data: {} }]
    expect(merge(a, b)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/__tests__/merge.test.js`
Expected: FAIL — cannot import from `../merge.js`.

- [ ] **Step 3: Implement `src/lib/merge.js`**

```js
/**
 * Pure sync primitives — shared by the client and the sync API.
 * Entity: { kind: 'item'|'note'|'log', id, updatedAt, deletedAt, data }.
 */
const KINDS = ['item', 'note', 'log']
const plural = { item: 'items', note: 'notes', log: 'logs' }

const asEntity = (kind, o) => ({
  kind,
  id: o.id,
  updatedAt: o.updatedAt ?? o.createdAt ?? 0,
  deletedAt: o.deletedAt ?? null,
  data: o,
})

export function toEntities({ items = [], notes = [], logs = [] }) {
  return [
    ...items.map((o) => asEntity('item', o)),
    ...notes.map((o) => asEntity('note', o)),
    ...logs.map((o) => asEntity('log', o)),
  ]
}

export function fromEntities(entities) {
  const out = { items: [], notes: [], logs: [] }
  for (const e of entities) {
    if (KINDS.includes(e.kind)) out[plural[e.kind]].push(e.data)
  }
  return out
}

export function merge(a, b) {
  const byKey = new Map()
  for (const e of [...a, ...b]) {
    const key = `${e.kind}:${e.id}`
    const cur = byKey.get(key)
    if (!cur || e.updatedAt >= cur.updatedAt) byKey.set(key, e)
  }
  return [...byKey.values()]
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/__tests__/merge.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merge.js src/lib/__tests__/merge.test.js
git commit -m "feat(merge): pure per-entity LWW merge + entity serialization"
```

---

## Task 4: Store — soft-delete tombstones, derived points, `mergeRemote`

**Files:**
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/store.test.js`

**Interfaces:**
- Consumes: `computePoints` (Task 2), `toEntities`/`fromEntities`/`merge` (Task 3).
- Produces (new store behavior):
  - Every created item/note carries `deletedAt: null`. Every created log carries `updatedAt` and `deletedAt: null`.
  - `deleteItem(id)`, `deleteNote(id)`, and the uncheck branches of `toggleDone`/`toggleHabitToday` set `deletedAt: now()` + bump `updatedAt` (tombstone) instead of dropping the record.
  - `points` is recomputed via `computePoints(logs)` after every log-changing mutation and after merge — never mutated directly.
  - Selectors (`selectAreaItems`, `selectItemNotes`, `selectJournal`) exclude tombstoned rows; `isHabitCheckedToday`/`toggleHabitToday` ignore tombstoned logs.
  - New action `mergeRemote(remoteEntities)` → merges remote entities into local, replaces `items/notes/logs`, recomputes points.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, selectAreaItems } from '../store.js'

const reset = () => useStore.setState({ items: [], notes: [], logs: [], points: 0 })

describe('store tombstones + points', () => {
  beforeEach(reset)

  it('deleteItem tombstones instead of dropping, and hides it', () => {
    const s = useStore.getState()
    const it = s.addItem('work', 'ship it')
    useStore.getState().deleteItem(it.id)
    const all = useStore.getState().items
    expect(all).toHaveLength(1)
    expect(all[0].deletedAt).toBeTruthy()
    expect(selectAreaItems('work')(useStore.getState())).toHaveLength(0)
  })

  it('completing then unchecking leaves a tombstoned log and 0 points', () => {
    const it = useStore.getState().addItem('work', 'task')
    useStore.getState().toggleDone(it.id)
    expect(useStore.getState().points).toBe(10)
    useStore.getState().toggleDone(it.id)
    expect(useStore.getState().points).toBe(0)
    expect(useStore.getState().logs.some((l) => l.deletedAt)).toBe(true)
  })

  it('mergeRemote applies a newer remote edit', () => {
    const it = useStore.getState().addItem('work', 'local title')
    const remote = [{ kind: 'item', id: it.id, updatedAt: it.updatedAt + 1000, deletedAt: null,
      data: { ...it, title: 'remote title', updatedAt: it.updatedAt + 1000 } }]
    useStore.getState().mergeRemote(remote)
    expect(useStore.getState().items.find((i) => i.id === it.id).title).toBe('remote title')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/__tests__/store.test.js`
Expected: FAIL — `deletedAt` undefined / `mergeRemote` not a function.

- [ ] **Step 3: Edit `src/lib/store.js`**

Add imports at top (with existing imports):
```js
import { computePoints } from './rewards'
import { toEntities, fromEntities, merge } from './merge'
```

In `addItem`, add `deletedAt: null,` to the created `item` object (next to `completedAt`).

In `addNote`, add `deletedAt: null` to the created `note` object, and give the journal log an `updatedAt`:
```js
const note = { id: uid(), areaId, itemId, text: text.trim(), createdAt: now(), updatedAt: now(), deletedAt: null }
```
and where it pushes the journal log, use:
```js
{ id: uid(), itemId: null, areaId, kind: 'journal', date: todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null }
```

Replace `toggleDone` with:
```js
toggleDone: (id) => {
  const item = get().items.find((i) => i.id === id)
  if (!item) return
  if (item.status === 'done') {
    const logs = get().logs.map((l) =>
      l.itemId === id && l.kind === 'complete' && l.date === todayKey() && !l.deletedAt
        ? { ...l, deletedAt: now(), updatedAt: now() }
        : l,
    )
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, status: 'open', completedAt: null, updatedAt: now() } : i,
      ),
      logs,
      points: computePoints(logs),
    })
  } else {
    const logs = [
      ...get().logs,
      { id: uid(), itemId: id, areaId: item.areaId, kind: 'complete', date: todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null },
    ]
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, status: 'done', completedAt: now(), updatedAt: now() } : i,
      ),
      logs,
      points: computePoints(logs),
    })
  }
},
```

Replace `toggleHabitToday` with:
```js
toggleHabitToday: (itemId) => {
  const { logs, items } = get()
  const date = todayKey()
  const existing = logs.find(
    (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === date && !l.deletedAt,
  )
  if (existing) {
    const next = logs.map((l) => (l.id === existing.id ? { ...l, deletedAt: now(), updatedAt: now() } : l))
    set({ logs: next, points: computePoints(next) })
  } else {
    const item = items.find((i) => i.id === itemId)
    const next = [
      ...logs,
      { id: uid(), itemId, areaId: item?.areaId ?? 'habits', kind: 'habit-check', date, createdAt: now(), updatedAt: now(), deletedAt: null },
    ]
    set({ logs: next, points: computePoints(next) })
  }
},
```

Replace `isHabitCheckedToday` to ignore tombstones:
```js
isHabitCheckedToday: (itemId) =>
  get().logs.some(
    (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === todayKey() && !l.deletedAt,
  ),
```

Replace `deleteItem` (tombstone the item + its notes + its logs, recompute points):
```js
deleteItem: (id) => {
  const stamp = now()
  const logs = get().logs.map((l) => (l.itemId === id && !l.deletedAt ? { ...l, deletedAt: stamp, updatedAt: stamp } : l))
  set({
    items: get().items.map((i) => (i.id === id ? { ...i, deletedAt: stamp, updatedAt: stamp } : i)),
    notes: get().notes.map((n) => (n.itemId === id && !n.deletedAt ? { ...n, deletedAt: stamp, updatedAt: stamp } : n)),
    logs,
    points: computePoints(logs),
  })
},
```

Replace `deleteNote`:
```js
deleteNote: (id) =>
  set({ notes: get().notes.map((n) => (n.id === id ? { ...n, deletedAt: now(), updatedAt: now() } : n)) }),
```

Add `mergeRemote` (next to the other actions):
```js
mergeRemote: (remoteEntities) => {
  const local = toEntities({ items: get().items, notes: get().notes, logs: get().logs })
  const merged = fromEntities(merge(local, remoteEntities))
  set({ items: merged.items, notes: merged.notes, logs: merged.logs, points: computePoints(merged.logs) })
},
```

Update the three selectors to drop tombstones:
```js
export const selectAreaItems = (areaId, showArchived = false) => (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.areaId === areaId && (showArchived ? i.status === 'archived' : i.status !== 'archived'))
    .sort((a, b) => a.order - b.order)

export const selectItemNotes = (itemId) => (s) =>
  s.notes.filter((n) => !n.deletedAt && n.itemId === itemId).sort((a, b) => b.createdAt - a.createdAt)

export const selectJournal = (s) =>
  s.notes.filter((n) => !n.deletedAt && n.areaId === 'journal' && !n.itemId).sort((a, b) => b.createdAt - a.createdAt)
```

Bump the persist `version` from `1` to `2` (schema changed):
```js
version: 2,
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/__tests__/store.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: PASS (all prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.js src/lib/__tests__/store.test.js
git commit -m "feat(store): soft-delete tombstones, derived points, mergeRemote"
```

---

## Task 5: Sync API — app factory, health, token gate

**Files:**
- Create: `server/sync/store.js` (in-memory EntityStore + interface)
- Create: `server/sync/app.js` (Express app factory)
- Test: `server/sync/__tests__/app.test.js`

**Interfaces:**
- Produces:
  - `MemoryStore()` → `{ async all(): Entity[], async merge(incoming: Entity[]): Entity[] }` (merge persists winners and returns the full set). Used by tests and as the interface the Mongo store (Task 6) implements.
  - `createApp({ store, token }) => express.App` with:
    - `GET /health` → `200 { ok: true }` (no auth).
    - `POST /sync` → requires `Authorization: Bearer <token>`; `401 { error }` if missing/wrong; body `{ entities: Entity[] }` → `200 { entities: Entity[], serverTime: number }`.
- Consumes: `merge` from `../../src/lib/merge.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore } from '../store.js'

const TOKEN = 'secret'
const app = () => createApp({ store: MemoryStore(), token: TOKEN })
const ent = (over) => ({ kind: 'item', id: 'i1', updatedAt: 1, deletedAt: null, data: { id: 'i1' }, ...over })

describe('sync API', () => {
  it('health needs no auth', async () => {
    await request(app()).get('/health').expect(200, { ok: true })
  })
  it('rejects missing token', async () => {
    await request(app()).post('/sync').send({ entities: [] }).expect(401)
  })
  it('rejects wrong token', async () => {
    await request(app()).post('/sync').set('Authorization', 'Bearer nope').send({ entities: [] }).expect(401)
  })
  it('stores and returns merged entities', async () => {
    const a = app()
    await request(a).post('/sync').set('Authorization', `Bearer ${TOKEN}`).send({ entities: [ent()] }).expect(200)
    const res = await request(a).post('/sync').set('Authorization', `Bearer ${TOKEN}`)
      .send({ entities: [ent({ updatedAt: 5, data: { id: 'i1', v: 2 } })] }).expect(200)
    expect(res.body.entities).toHaveLength(1)
    expect(res.body.entities[0].data.v).toBe(2)
    expect(typeof res.body.serverTime).toBe('number')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test server/sync/__tests__/app.test.js`
Expected: FAIL — cannot import `../app.js`.

- [ ] **Step 3: Implement `server/sync/store.js`**

```js
import { merge } from '../../src/lib/merge.js'

// In-memory EntityStore — the interface the Mongo store implements.
export function MemoryStore() {
  let entities = []
  return {
    async all() {
      return entities
    },
    async merge(incoming) {
      entities = merge(entities, incoming)
      return entities
    },
  }
}
```

- [ ] **Step 4: Implement `server/sync/app.js`**

```js
import express from 'express'
import cors from 'cors'

export function createApp({ store, token }) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use((req, res, next) => {
    const header = req.get('authorization') || ''
    const provided = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!provided || provided !== token) return res.status(401).json({ error: 'bad token' })
    next()
  })

  app.post('/sync', async (req, res) => {
    const incoming = Array.isArray(req.body?.entities) ? req.body.entities : []
    const entities = await store.merge(incoming)
    res.json({ entities, serverTime: Date.now() })
  })

  return app
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test server/sync/__tests__/app.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/sync/store.js server/sync/app.js server/sync/__tests__/app.test.js
git commit -m "feat(sync-api): app factory with health + token-gated /sync"
```

---

## Task 6: Sync API — Mongo-backed store + entrypoint

**Files:**
- Create: `server/sync/mongoStore.js`
- Create: `server/sync/index.js`
- Test: `server/sync/__tests__/mongoStore.test.js`

**Interfaces:**
- Consumes: `merge` (`../../src/lib/merge.js`), Mongoose.
- Produces:
  - `mongoStore(mongoose) => { all(), merge(incoming) }` — same interface as `MemoryStore`, persisting to a single `Entity` collection keyed by `{ kind, id }`.
  - `server/sync/index.js` — reads env `MONGODB_URI`, `SYNC_TOKEN`, `PORT` (default 4000); connects Mongoose; builds `mongoStore`; `createApp`; listens. Exits with a clear message if `MONGODB_URI` or `SYNC_TOKEN` is missing.

- [ ] **Step 1: Write the failing test** (uses mongodb-memory-server)

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { mongoStore } from '../mongoStore.js'

let mem
beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri())
}, 60000)
afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

const ent = (over) => ({ kind: 'note', id: 'n1', updatedAt: 1, deletedAt: null, data: { id: 'n1', text: 'a' }, ...over })

describe('mongoStore', () => {
  it('persists and merges by updatedAt', async () => {
    const store = mongoStore(mongoose)
    await store.merge([ent()])
    const after = await store.merge([ent({ updatedAt: 9, data: { id: 'n1', text: 'b' } })])
    const n1 = after.find((e) => e.id === 'n1')
    expect(n1.data.text).toBe('b')
    expect((await store.all()).length).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test server/sync/__tests__/mongoStore.test.js`
Expected: FAIL — cannot import `../mongoStore.js`. (First run downloads a mongod binary; allow time.)

- [ ] **Step 3: Implement `server/sync/mongoStore.js`**

```js
import mongoose from 'mongoose'
import { merge } from '../../src/lib/merge.js'

const schema = new mongoose.Schema(
  {
    kind: { type: String, required: true },
    id: { type: String, required: true },
    updatedAt: { type: Number, required: true },
    deletedAt: { type: Number, default: null },
    data: { type: Object, required: true },
  },
  { versionKey: false },
)
schema.index({ kind: 1, id: 1 }, { unique: true })

export function mongoStore(mongooseInstance = mongoose) {
  const Entity = mongooseInstance.models.Entity || mongooseInstance.model('Entity', schema)

  const toPlain = (doc) => ({ kind: doc.kind, id: doc.id, updatedAt: doc.updatedAt, deletedAt: doc.deletedAt ?? null, data: doc.data })

  return {
    async all() {
      return (await Entity.find({}).lean()).map(toPlain)
    },
    async merge(incoming) {
      const current = await this.all()
      const merged = merge(current, incoming)
      // Upsert winners (cheap at personal scale — full set each sync).
      await Promise.all(
        merged.map((e) =>
          Entity.updateOne({ kind: e.kind, id: e.id }, { $set: { updatedAt: e.updatedAt, deletedAt: e.deletedAt ?? null, data: e.data } }, { upsert: true }),
        ),
      )
      return merged
    },
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test server/sync/__tests__/mongoStore.test.js`
Expected: PASS.

- [ ] **Step 5: Implement `server/sync/index.js`** (no automated test — manual/deploy entrypoint)

```js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { createApp } from './app.js'
import { mongoStore } from './mongoStore.js'

dotenv.config()

const { MONGODB_URI, SYNC_TOKEN, PORT = 4000 } = process.env
if (!MONGODB_URI || !SYNC_TOKEN) {
  console.error('Sync API needs MONGODB_URI and SYNC_TOKEN')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI)
const app = createApp({ store: mongoStore(mongoose), token: SYNC_TOKEN })
app.listen(PORT, () => console.log(`Sync API on :${PORT}`))
```

- [ ] **Step 6: Add script to `package.json`**

Add to `scripts`: `"sync": "node server/sync/index.js"`

- [ ] **Step 7: Commit**

```bash
git add server/sync/mongoStore.js server/sync/index.js package.json
git commit -m "feat(sync-api): mongo-backed store + entrypoint"
```

---

## Task 7: Client sync module

**Files:**
- Create: `src/lib/sync.js`
- Test: `src/lib/__tests__/sync.test.js`

**Interfaces:**
- Consumes: `toEntities` (Task 3); `useStore` + `mergeRemote` (Task 4).
- Produces:
  - `getSyncToken()` / `setSyncToken(t)` — read/write `localStorage['lifetracker.syncToken']`.
  - `useSyncStatus` — a zustand store `{ lastSyncedAt: number|null, error: string|null }`.
  - `syncNow()` — `POST {VITE_SYNC_URL}/sync` with `{ entities: toEntities(store) }` and the bearer token; on 200 calls `useStore.getState().mergeRemote(res.entities)` and sets `lastSyncedAt`; on 401 sets `error = 'Check your sync token'`; on network error sets `error` but does not throw. No-ops (returns early) if no token or no `VITE_SYNC_URL`.
  - `startSync()` — subscribes to `useStore` (debounced 1500ms push) and adds `focus`/`online` listeners that call `syncNow()`; idempotent (guards against double-init). Returns a cleanup function.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSyncToken, setSyncToken, syncNow, useSyncStatus } from '../sync.js'
import { useStore } from '../store.js'

beforeEach(() => {
  globalThis.localStorage = (() => {
    let m = {}
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v) }, removeItem: (k) => { delete m[k] } }
  })()
  import.meta.env.VITE_SYNC_URL = 'https://sync.test'
  useStore.setState({ items: [], notes: [], logs: [], points: 0 })
  useSyncStatus.setState({ lastSyncedAt: null, error: null })
})

describe('sync token', () => {
  it('round-trips', () => {
    setSyncToken('abc')
    expect(getSyncToken()).toBe('abc')
  })
})

describe('syncNow', () => {
  it('no-ops without a token', async () => {
    const fetch = vi.fn()
    globalThis.fetch = fetch
    await syncNow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('merges returned entities and records lastSyncedAt', async () => {
    setSyncToken('t')
    const it = useStore.getState().addItem('work', 'local')
    const remote = { entities: [{ kind: 'item', id: it.id, updatedAt: it.updatedAt + 100, deletedAt: null, data: { ...it, title: 'remote', updatedAt: it.updatedAt + 100 } }], serverTime: 1 }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => remote })
    await syncNow()
    expect(useStore.getState().items.find((i) => i.id === it.id).title).toBe('remote')
    expect(useSyncStatus.getState().lastSyncedAt).toBeTruthy()
  })

  it('sets a friendly error on 401', async () => {
    setSyncToken('bad')
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    await syncNow()
    expect(useSyncStatus.getState().error).toMatch(/token/i)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/__tests__/sync.test.js`
Expected: FAIL — cannot import `../sync.js`.

- [ ] **Step 3: Implement `src/lib/sync.js`**

```js
import { create } from 'zustand'
import { useStore } from './store'
import { toEntities } from './merge'

const TOKEN_KEY = 'lifetracker.syncToken'

export const getSyncToken = () => localStorage.getItem(TOKEN_KEY)
export const setSyncToken = (t) => localStorage.setItem(TOKEN_KEY, t)

export const useSyncStatus = create(() => ({ lastSyncedAt: null, error: null }))

const baseUrl = () => import.meta.env.VITE_SYNC_URL || ''

export async function syncNow() {
  const token = getSyncToken()
  const url = baseUrl()
  if (!token || !url) return

  const { items, notes, logs } = useStore.getState()
  try {
    const res = await fetch(`${url}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entities: toEntities({ items, notes, logs }) }),
    })
    if (res.status === 401) {
      useSyncStatus.setState({ error: 'Check your sync token' })
      return
    }
    if (!res.ok) {
      useSyncStatus.setState({ error: `Sync failed (${res.status})` })
      return
    }
    const body = await res.json()
    useStore.getState().mergeRemote(body.entities || [])
    useSyncStatus.setState({ lastSyncedAt: Date.now(), error: null })
  } catch {
    // Offline / unreachable — stay local, retry on next focus/online.
    useSyncStatus.setState({ error: null })
  }
}

let started = false
export function startSync() {
  if (started) return () => {}
  started = true

  let timer = null
  const push = () => {
    clearTimeout(timer)
    timer = setTimeout(syncNow, 1500)
  }
  const unsub = useStore.subscribe(push)
  const pull = () => syncNow()
  window.addEventListener('focus', pull)
  window.addEventListener('online', pull)
  syncNow() // initial pull

  return () => {
    started = false
    clearTimeout(timer)
    unsub()
    window.removeEventListener('focus', pull)
    window.removeEventListener('online', pull)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/__tests__/sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js src/lib/__tests__/sync.test.js
git commit -m "feat(sync): client push/pull module with token + status"
```

---

## Task 8: Token-entry UI + wire sync into the app

**Files:**
- Create: `src/views/Settings.jsx`
- Modify: `src/App.jsx` (route + `startSync()` on mount)
- Modify: `src/components/BottomNav.jsx` (gear link to `/settings`)
- Test: `src/lib/__tests__/sync.test.js` (extend — no React test; wiring is verified manually)

**Interfaces:**
- Consumes: `getSyncToken`/`setSyncToken`/`useSyncStatus`/`syncNow`/`startSync` (Task 7).
- Produces: a `/settings` route with a token field + sync status; sync starts once when the app mounts.

- [ ] **Step 1: Implement `src/views/Settings.jsx`**

```jsx
import { useState } from 'react'
import { getSyncToken, setSyncToken, syncNow, useSyncStatus } from '../lib/sync'

export default function Settings() {
  const [token, setToken] = useState(getSyncToken() || '')
  const status = useSyncStatus()

  const save = () => {
    setSyncToken(token.trim())
    syncNow()
  }

  return (
    <main className="view settings">
      <h1>Sync</h1>
      <p>Paste your private sync token to link this device.</p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="sync token"
        aria-label="Sync token"
      />
      <button onClick={save}>Save & sync</button>
      {status.error && <p className="sync-error">{status.error}</p>}
      {status.lastSyncedAt && !status.error && (
        <p className="sync-ok">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString()}</p>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Wire routing + startup in `src/App.jsx`**

Add imports:
```js
import { useEffect } from 'react'
import Settings from './views/Settings'
import { startSync } from './lib/sync'
```
Add `useEffect(() => startSync(), [])` inside the `App` component (before `return`). Add the route inside `<Routes>`:
```jsx
<Route path="/settings" element={<Settings />} />
```
(Adjust the existing `import { useState } from 'react'` to `import { useState, useEffect } from 'react'`.)

- [ ] **Step 3: Add a gear link in `src/components/BottomNav.jsx`**

Add after the Journal `NavLink`:
```jsx
<NavLink to="/settings">
  <span className="nav-ico">⚙️</span>Sync
</NavLink>
```

- [ ] **Step 4: Manual verification**

Run: `pnpm run dev`, open the app, go to ⚙️ Sync, confirm the field saves (reload → value persists) and that with no `VITE_SYNC_URL` set nothing errors in the console.

- [ ] **Step 5: Run the suite**

Run: `pnpm test`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/views/Settings.jsx src/App.jsx src/components/BottomNav.jsx
git commit -m "feat(sync): token entry UI + start sync on app mount"
```

---

## Task 9: Make the assistant server stateless

**Files:**
- Modify: `server.js` (remove Mongo; take `sessionId` from the request)
- Modify: `src/lib/api.js` (send/receive `sessionId`, store it locally)
- Modify: `package.json` (remove `mongoose` from the assistant path is NOT required — the sync API still uses it; keep it)

**Interfaces:**
- Produces:
  - `POST /api/assist` body `{ message: string, sessionId?: string }` → `{ sessionId: string|null, message: string }`. No database.
  - `askAssistant(message, { sessionId }) => { sessionId, message }` in `api.js`; caller persists `sessionId` (kept in component state or the store; transcript is local-only per the spec).

- [ ] **Step 1: Rewrite `server.js`**

Replace the whole file with (drops mongoose/Conversation, keeps the Agent SDK `runTurn` and static-serving):
```js
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '@anthropic-ai/claude-agent-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const SYSTEM_PROMPT =
  "You are a supportive personal assistant embedded in the user's Lifetracker app. " +
  'Help them reflect on habits, journal entries, and goals. Keep replies concise and encouraging.'

async function runTurn(message, resumeSessionId) {
  const options = { model: 'claude-opus-4-8', systemPrompt: SYSTEM_PROMPT, allowedTools: [], maxTurns: 1, settingSources: [] }
  if (resumeSessionId) options.resume = resumeSessionId
  let sessionId = resumeSessionId || null
  let text = ''
  for await (const evt of query({ prompt: message, options })) {
    if (evt.type === 'system' && evt.session_id) sessionId = evt.session_id
    if (evt.type === 'result') {
      if (typeof evt.result === 'string') text = evt.result
      else if (Array.isArray(evt.content)) text = evt.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    }
  }
  return { text, sessionId }
}

app.post('/api/assist', async (req, res) => {
  try {
    const { message, sessionId } = req.body
    if (!message) return res.status(400).json({ error: 'Missing message' })
    const { text, sessionId: newId } = await runTurn(message, sessionId)
    res.json({ sessionId: newId, message: text || 'Unable to parse response' })
  } catch (err) {
    console.error('assist error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => (req.path.startsWith('/api/') ? next() : res.sendFile(path.join(distDir, 'index.html'))))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Assistant server on :${PORT}`))
```

- [ ] **Step 2: Update `src/lib/api.js`**

```js
const ASSIST_BASE =
  import.meta.env.VITE_ASSIST_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

export async function askAssistant(message, { sessionId } = {}) {
  const res = await fetch(`${ASSIST_BASE}/api/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (!res.ok) throw new Error(`Assistant error: ${res.status}`)
  return res.json() // { sessionId, message }
}
```

- [ ] **Step 3: Manual smoke test the assistant** (requires desktop Claude login)

Run: `pnpm run server`, then:
```bash
curl -s -X POST http://localhost:3001/api/assist -H 'Content-Type: application/json' -d '{"message":"say hi in 3 words"}'
```
Expected: JSON with a non-empty `message` and a `sessionId`. If it returns an auth error, run `npx @anthropic-ai/claude-agent-sdk` and log in, then retry.

- [ ] **Step 4: Commit**

```bash
git add server.js src/lib/api.js
git commit -m "refactor(assistant): stateless server, sessionId via client"
```

---

## Task 10: Config, env, and docs

**Files:**
- Modify: `.env.example`
- Create: `server/sync/.env.example`
- Modify: `BACKEND_SETUP.md`

**Interfaces:** none (documentation/config).

- [ ] **Step 1: Update root `.env.example`** (frontend + assistant)

```
# Frontend build-time config (Vite)
VITE_SYNC_URL=            # always-on sync API base URL, e.g. https://lifetracker-sync.fly.dev
VITE_ASSIST_URL=          # desktop assistant tunnel, e.g. https://brutus.<tailnet>.ts.net

# Assistant server (desktop) — Claude auth is your subscription login, nothing here.
PORT=3001
```

- [ ] **Step 2: Create `server/sync/.env.example`**

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lifetracker?retryWrites=true&w=majority
SYNC_TOKEN=change-me-to-a-long-random-string
PORT=4000
```

- [ ] **Step 3: Rewrite `BACKEND_SETUP.md`** to document three run targets:

Include: (a) `pnpm run sync` = always-on sync API (env from `server/sync/.env`), deploy to Fly.io/Railway; (b) `pnpm run server` = desktop assistant, exposed via `tailscale serve --bg 3001`; (c) `pnpm run build` + static host for the frontend, with `VITE_SYNC_URL` baked in; (d) the sync token is pasted into each device under ⚙️ Sync, never built in. State plainly: notes sync whenever the sync API is reachable (desktop irrelevant); the assistant answers only while the desktop server runs.

- [ ] **Step 4: Commit**

```bash
git add .env.example server/sync/.env.example BACKEND_SETUP.md
git commit -m "docs: env + three-target run/deploy guide for sync + assistant"
```

---

## Task 11: Full-suite green + convergence check

**Files:** none (verification).

- [ ] **Step 1: Run everything**

Run: `pnpm test`
Expected: PASS across rewards, merge, store, sync, sync-api, mongoStore.

- [ ] **Step 2: Lint**

Run: `pnpm run lint`
Expected: no new errors in touched files.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: succeeds; `dist/` produced.

- [ ] **Step 4: Two-client convergence (manual, optional but recommended)**

Start the sync API against a local/in-memory Mongo, set the same token in two browser profiles pointed at it, add a note in one, focus the other → the note appears; delete it in one → it disappears in the other after focus.

- [ ] **Step 5: Final commit if anything changed**

```bash
git add -A && git commit -m "chore: verify sync + assistant suite green" || echo "nothing to commit"
```

---

## Self-Review (author's notes — completed)

- **Spec coverage:** always-on sync API (T5–6), per-entity LWW + tombstones (T3–4), single pasted token (T5, T7–8), derived points (T2, T4), client push/pull with offline handling (T7), stateless assistant + sessionId (T9), config/hosts (T10), tests incl. two-client convergence (T6, T11). All spec sections mapped.
- **Type consistency:** entity shape `{kind,id,updatedAt,deletedAt,data}` and store interfaces (`mergeRemote`, `toEntities`/`fromEntities`/`merge`, `computePoints`, `MemoryStore`/`mongoStore` `{all,merge}`, `syncNow`/`startSync`) are used identically across tasks.
- **Note:** `mongodb-memory-server` downloads a mongod binary on first `pnpm test` run — allow time / network; this is the only test with an external fetch.
