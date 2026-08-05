# Nudge Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Nudges area of always-on interval timers that fire a custom notification message whenever Stoa is open.

**Architecture:** A new `'timers'` area kind whose ITEMs carry `intervalMin` and `enabled`. All scheduling logic lives in one pure module (`timers.js`) that takes a clock and a last-fired map as arguments; a thin platform wrapper (`notify.js`) owns the Notification API; a dependency-injected runner glues them with a single 15-second interval. Last-fired anchors and quiet hours are device-local `localStorage`, never synced.

**Tech Stack:** React 19, zustand + persist (IndexedDB via idb-keyval), react-router-dom HashRouter, lucide-react icons, vitest (node environment).

Spec: [2026-08-04-nudge-timers-design.md](../specs/2026-08-04-nudge-timers-design.md)

## Global Constraints

- **No emoji, dingbats, or arrow glyphs anywhere in `src/`.** Enforced by `src/lib/__tests__/no-emoji.test.js`, which walks every `.js/.jsx/.css/.html` file outside `__tests__`. Use `lucide-react` components for every glyph. This includes characters like `✓`, `→`, and `⏱`.
- **Vitest environment is `node`** (`vitest.config.js`). There is no DOM, no `window`, no `localStorage`, and no `Notification`. Modules that touch browser globals must not do so at module top level, or importing them in a test will throw.
- **Components are never rendered in tests.** The convention (`src/components/__tests__/AreaIcon.test.js`) is to call a component as a plain function and assert on the returned element. Components using hooks are not unit tested at all.
- **4 primitives, not 12 modules.** No new store slice, no new log kind, no new primitive. See `CLAUDE.md`.
- **Trim colors are used at most twice across `AREAS`** — enforced by `src/data/__tests__/areas.test.js`. `o` is currently used once (learnings), so `nudges` may take `o`.
- **`pnpm test` and `pnpm lint` must both be green before every commit.**
- Conventional commit messages, lowercase scope, e.g. `feat(nudges): ...`.
- Branch: `nudge-timers` (already created; the spec commit `0a108f7` is on it).

---

### Task 1: Area registry row and config-driven routing

Adds the Nudges area and replaces the `kind` ternary in `AreasGrid` with an optional `route` field, so a fourth non-generic area kind does not lengthen a chain.

**Files:**
- Modify: `src/data/areas.js`
- Modify: `src/views/AreasGrid.jsx:22-25`
- Test: `src/data/__tests__/areas.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: area `{ id: 'nudges', kind: 'timers', route: '/nudges' }` in `AREAS`; `routeFor(area) -> string` exported from `src/data/areas.js`.

- [ ] **Step 1: Write the failing test**

In `src/data/__tests__/areas.test.js`, add `nudges` to the `EXPECTED` map (it sits alongside the existing nine entries):

```js
const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  fitness: { trim: 'y', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  habits: { trim: 'r', icon: 'KeyRound' },
  journal: { trim: 'b', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  learnings: { trim: 'o', icon: 'Brain' },
  nudges: { trim: 'o', icon: 'BellRing' },
}
```

Change the first test's name and leave its body as-is (it derives from `EXPECTED`):

```js
  it('has exactly the 10 known areas', () => {
    expect(AREAS.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })
```

Add `routeFor` to the import at the top of the file:

```js
import { AREAS, DAILY_BANDS, routeFor } from '../areas'
```

Then append this block at the end of the file:

```js
describe('routing', () => {
  it('gives the nudges area the timers kind and no daily band', () => {
    const nudges = AREAS.find((a) => a.id === 'nudges')
    expect(nudges.kind).toBe('timers')
    expect(nudges.daily).toBeUndefined()
    expect(nudges.buckets).toEqual([])
  })

  it('routes the three non-generic areas to their own pages', () => {
    const routes = Object.fromEntries(AREAS.map((a) => [a.id, routeFor(a)]))
    expect(routes.journal).toBe('/journal')
    expect(routes.habits).toBe('/habits')
    expect(routes.nudges).toBe('/nudges')
  })

  it('routes every other area through the generic area view', () => {
    for (const a of AREAS) {
      if (['journal', 'habits', 'nudges'].includes(a.id)) continue
      expect(routeFor(a)).toBe(`/area/${a.id}`)
    }
  })

  it('leaves the daily bands untouched by the new area', () => {
    expect(DAILY_BANDS.map((a) => a.id)).toEqual(['journal', 'diet', 'fitness', 'habits'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/__tests__/areas.test.js`
Expected: FAIL — `routeFor is not a function`, and the 10-areas test fails because `nudges` is missing from `AREAS`.

- [ ] **Step 3: Write minimal implementation**

In `src/data/areas.js`, add `route` to the two existing non-generic areas. Change the `habits` row to include `route: '/habits'` and the `journal` row to include `route: '/journal'`:

```js
  {
    id: 'habits', name: 'Keystone Habits', icon: 'KeyRound', kind: 'habits',
    trim: 'r', route: '/habits',
    daily: { order: 4, series: 2 },
    keywords: ['habit', 'daily', 'streak', 'keystone'],
    buckets: [],
  },
  {
    id: 'journal', name: 'Journal', icon: 'NotebookPen', kind: 'journal',
    trim: 'b', route: '/journal',
    daily: { order: 1, series: 1 },
    keywords: ['journal', 'today i', 'feeling', 'grateful', 'reflect'],
    buckets: [],
  },
```

Add the new row at the end of the `AREAS` array, after `learnings`:

```js
  {
    id: 'nudges', name: 'Nudges', icon: 'BellRing', kind: 'timers',
    trim: 'o', route: '/nudges',
    keywords: ['remind', 'nudge', 'timer', 'every', 'water', 'stretch', 'posture'],
    buckets: [],
  },
```

Update the file's leading doc comment: in the `kind:` list, add a line after the `'library'` line:

```
 *  - 'timers'  - interval nudges that fire a notification while the app is open
```

and add a paragraph after the `daily` paragraph:

```
 * `route` overrides the destination the areas grid links to. Areas without it
 * fall through to the generic /area/:id view. It exists so adding an area with
 * its own page stays a config change rather than another branch in a ternary.
```

Add the helper at the bottom of the file, next to `areaById`:

```js
/** Where the areas grid links this area. Generic list/library areas share one view. */
export const routeFor = (area) => area.route ?? `/area/${area.id}`
```

In `src/views/AreasGrid.jsx`, change the import on line 2 and the `Link`'s `to` prop:

```js
import { AREAS, routeFor } from '../data/areas'
```

```jsx
          <Link key={a.id} to={routeFor(a)}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS, entire suite. `areas.test.js` now covers 10 areas; `no-emoji.test.js` still passes because `BellRing` is a component name, not a glyph.

- [ ] **Step 5: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js src/views/AreasGrid.jsx
git commit -m "feat(areas): nudges area row and config-driven routing"
```

---

### Task 2: Pure scheduling logic

Everything that can be wrong about timing lives here, with no DOM and no real clock. `now` and the anchor map are arguments.

**Files:**
- Create: `src/lib/timers.js`
- Test: `src/lib/__tests__/timers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULT_QUIET` — `{ on: true, startMin: 1380, endMin: 420 }` (23:00–07:00, minutes from local midnight).
  - `inQuietHours(now: number, quiet: object) -> boolean`
  - `tickPlan(nudges: Array, lastFired: object, quiet: object, now: number) -> { fire: string[], anchors: object }`
  - `nextFireAt(nudge: object, lastFired: object) -> number | null`

A `nudge` here is an ITEM with at least `{ id, title, intervalMin, enabled }`. `lastFired` maps item id to an epoch-ms anchor.

**Design note:** the spec listed `nextWakeAt`. It has no consumer — the runner polls on a fixed cadence rather than scheduling a wake — so it is cut in favour of `nextFireAt`, which the view needs for its per-nudge countdown.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/timers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { DEFAULT_QUIET, inQuietHours, tickPlan, nextFireAt } from '../timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }

/** Epoch ms for a local wall-clock time today, so quiet-hours tests are TZ-safe. */
const at = (h, m = 0) => {
  const d = new Date(2026, 7, 4, h, m, 0, 0)
  return d.getTime()
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })

describe('inQuietHours', () => {
  it('is false when quiet hours are switched off', () => {
    expect(inQuietHours(at(2), OFF)).toBe(false)
  })

  it('treats the default window as wrapping midnight', () => {
    expect(DEFAULT_QUIET).toEqual({ on: true, startMin: 23 * 60, endMin: 7 * 60 })
    expect(inQuietHours(at(23, 30), DEFAULT_QUIET)).toBe(true)
    expect(inQuietHours(at(3), DEFAULT_QUIET)).toBe(true)
    expect(inQuietHours(at(6, 59), DEFAULT_QUIET)).toBe(true)
  })

  it('excludes waking hours from the default window', () => {
    expect(inQuietHours(at(7), DEFAULT_QUIET)).toBe(false)
    expect(inQuietHours(at(12), DEFAULT_QUIET)).toBe(false)
    expect(inQuietHours(at(22, 59), DEFAULT_QUIET)).toBe(false)
  })

  it('handles a same-day window that does not wrap', () => {
    const nap = { on: true, startMin: 13 * 60, endMin: 14 * 60 }
    expect(inQuietHours(at(13, 30), nap)).toBe(true)
    expect(inQuietHours(at(12, 59), nap)).toBe(false)
    expect(inQuietHours(at(14), nap)).toBe(false)
  })

  it('is false for missing quiet config', () => {
    expect(inQuietHours(at(2), undefined)).toBe(false)
  })
})

describe('tickPlan', () => {
  it('fires a nudge whose interval has elapsed and resets its anchor', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], { a: now - 45 * MIN }, OFF, now)
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('does not fire inside the interval', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], { a: now - 44 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('never fires a disabled nudge', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45, false)], { a: now - 99 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('never fires a nudge with no anchor, so enabling seeds the interval', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], {}, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('ignores a nudge with a missing or zero interval', () => {
    const now = at(12)
    const bad = [{ id: 'a', title: 'x', enabled: true }, nudge('b', 0)]
    const plan = tickPlan(bad, { a: now - 99 * MIN, b: now - 99 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
  })

  it('fires once when many intervals are overdue, never a burst', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], { a: now - 8 * 45 * MIN }, OFF, now)
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('suppresses firing during quiet hours but still advances the anchor', () => {
    const now = at(3)
    const plan = tickPlan([nudge('a', 45)], { a: now - 90 * MIN }, DEFAULT_QUIET, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('handles several nudges independently in one tick', () => {
    const now = at(12)
    const plan = tickPlan(
      [nudge('a', 45), nudge('b', 120), nudge('c', 30)],
      { a: now - 46 * MIN, b: now - 10 * MIN, c: now - 30 * MIN },
      OFF,
      now,
    )
    expect(plan.fire.sort()).toEqual(['a', 'c'])
    expect(plan.anchors).toEqual({ a: now, c: now })
  })

  it('returns empty plans for an empty nudge list', () => {
    expect(tickPlan([], {}, OFF, at(12))).toEqual({ fire: [], anchors: {} })
  })
})

describe('nextFireAt', () => {
  it('is one interval past the anchor', () => {
    const anchor = at(12)
    expect(nextFireAt(nudge('a', 45), { a: anchor })).toBe(anchor + 45 * MIN)
  })

  it('is null for a disabled nudge or one with no anchor', () => {
    expect(nextFireAt(nudge('a', 45, false), { a: at(12) })).toBeNull()
    expect(nextFireAt(nudge('a', 45), {})).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/timers.test.js`
Expected: FAIL — `Cannot find module '../timers.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/timers.js`:

```js
/**
 * Nudge scheduling — pure. No DOM, no real clock, no storage: `now` and the
 * last-fired anchor map are always arguments, which is what makes every rule
 * below testable without fake timers.
 *
 * A nudge is an ITEM in the 'nudges' area carrying { intervalMin, enabled }.
 * `lastFired` maps item id to an epoch-ms anchor and is DEVICE-LOCAL — if it
 * synced, a nudge firing on the phone would silently suppress the desktop.
 */

const MS_PER_MIN = 60_000

/** Quiet hours as minutes from local midnight. Wraps midnight by design. */
export const DEFAULT_QUIET = { on: true, startMin: 23 * 60, endMin: 7 * 60 }

/**
 * Whether `now` falls inside the quiet window. A window whose start is after
 * its end (the common case: 23:00-07:00) wraps past midnight, so the test
 * flips from AND to OR.
 */
export function inQuietHours(now, quiet) {
  if (!quiet || !quiet.on) return false
  const d = new Date(now)
  const mins = d.getHours() * 60 + d.getMinutes()
  const { startMin: start, endMin: end } = quiet
  return start > end ? mins >= start || mins < end : mins >= start && mins < end
}

/**
 * What this tick should do:
 *   fire    - ids to notify for right now
 *   anchors - lastFired updates to persist (empty when nothing changed)
 *
 * Two rules the caller must not re-implement:
 *
 * 1. Catch-up is suppressed. A nudge eight intervals overdue (laptop slept)
 *    fires ONCE and its anchor resets to `now`. Eight identical notifications
 *    is never the right answer.
 * 2. Quiet hours suppress the notification but STILL advance the anchor, so
 *    07:00 is not an avalanche of everything that came due overnight.
 *
 * A nudge with no anchor is never due: enabling one seeds its anchor, so
 * "every 45m" means 45 minutes from when it was switched on.
 */
export function tickPlan(nudges, lastFired, quiet, now) {
  const quietNow = inQuietHours(now, quiet)
  const fire = []
  const anchors = {}
  for (const n of nudges) {
    if (!n.enabled || !(n.intervalMin > 0)) continue
    const anchor = lastFired[n.id]
    if (anchor == null) continue
    if (now - anchor < n.intervalMin * MS_PER_MIN) continue
    anchors[n.id] = now
    if (!quietNow) fire.push(n.id)
  }
  return { fire, anchors }
}

/** When this nudge is next due, or null if it is off or unanchored. */
export function nextFireAt(nudge, lastFired) {
  if (!nudge.enabled || !(nudge.intervalMin > 0)) return null
  const anchor = lastFired[nudge.id]
  if (anchor == null) return null
  return anchor + nudge.intervalMin * MS_PER_MIN
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/timers.test.js`
Expected: PASS, 17 tests.

Then run: `pnpm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timers.js src/lib/__tests__/timers.test.js
git commit -m "feat(nudges): pure interval scheduling with quiet hours and catch-up suppression"
```

---

### Task 3: Notification platform wrapper

Isolates every browser global so `timers.js` stays pure and the runner can be tested with a fake.

**Files:**
- Create: `src/lib/notify.js`
- Test: `src/lib/__tests__/notify.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `notifyPermission() -> 'granted' | 'denied' | 'default' | 'unsupported'`
  - `requestNotifyPermission() -> Promise<permission>`
  - `fireNotification(body: string, tag: string) -> Promise<boolean>` — `true` when a notification was shown.

Browser globals are read **inside** each function via `globalThis`, never at module top level, so importing this file under the node test environment cannot throw.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/notify.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { notifyPermission, requestNotifyPermission, fireNotification } from '../notify.js'

const clean = () => {
  delete globalThis.Notification
  delete globalThis.__swRegistration
}

/** Minimal Notification stand-in; the node test env has no DOM. */
const stubNotification = (permission, { onConstruct } = {}) => {
  const ctor = function (title, options) {
    onConstruct?.(title, options)
  }
  ctor.permission = permission
  ctor.requestPermission = vi.fn().mockResolvedValue('granted')
  globalThis.Notification = ctor
  return ctor
}

describe('notifyPermission', () => {
  beforeEach(clean)
  afterEach(clean)

  it('reports unsupported when the API is absent', () => {
    expect(notifyPermission()).toBe('unsupported')
  })

  it('reflects the current browser permission', () => {
    stubNotification('denied')
    expect(notifyPermission()).toBe('denied')
    stubNotification('granted')
    expect(notifyPermission()).toBe('granted')
  })
})

describe('requestNotifyPermission', () => {
  beforeEach(clean)
  afterEach(clean)

  it('resolves unsupported without throwing when the API is absent', async () => {
    await expect(requestNotifyPermission()).resolves.toBe('unsupported')
  })

  it('delegates to the browser when available', async () => {
    const ctor = stubNotification('default')
    await expect(requestNotifyPermission()).resolves.toBe('granted')
    expect(ctor.requestPermission).toHaveBeenCalledOnce()
  })
})

describe('fireNotification', () => {
  beforeEach(clean)
  afterEach(clean)

  it('shows nothing and reports false when unsupported', async () => {
    await expect(fireNotification('drink water', 'a')).resolves.toBe(false)
  })

  it('shows nothing and reports false when permission is not granted', async () => {
    stubNotification('default')
    await expect(fireNotification('drink water', 'a')).resolves.toBe(false)
  })

  it('constructs a notification with the message as the body', async () => {
    const seen = []
    stubNotification('granted', { onConstruct: (title, options) => seen.push({ title, options }) })
    await expect(fireNotification('drink water', 'nudge-1')).resolves.toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0].title).toBe('Stoa')
    expect(seen[0].options.body).toBe('drink water')
    expect(seen[0].options.tag).toBe('nudge-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/notify.test.js`
Expected: FAIL — `Cannot find module '../notify.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/notify.js`:

```js
/**
 * The only module that touches the Notification API. Keeping it here is what
 * lets timers.js stay pure and the nudge runner be tested with a fake `fire`.
 *
 * Every browser global is read INSIDE a function via globalThis, never at
 * module top level, because the vitest environment is `node` — a top-level
 * `Notification` reference would throw on import.
 */

export const UNSUPPORTED = 'unsupported'

/** 'granted' | 'denied' | 'default' | 'unsupported'. */
export function notifyPermission() {
  const N = globalThis.Notification
  return N ? N.permission : UNSUPPORTED
}

/**
 * Must be called from a user gesture — iOS requires it, and asking on app
 * load is the reliable way to get permanently denied.
 */
export async function requestNotifyPermission() {
  const N = globalThis.Notification
  if (!N) return UNSUPPORTED
  return N.requestPermission()
}

/**
 * Show one notification. Prefers the service worker registration (the only
 * path that works for an installed PWA) and falls back to the constructor.
 * `tag` is the nudge's item id, so repeat fires replace rather than stack.
 * Returns whether anything was actually shown.
 */
export async function fireNotification(body, tag) {
  if (notifyPermission() !== 'granted') return false
  const reg = await globalThis.navigator?.serviceWorker?.getRegistration?.()
  if (reg) {
    await reg.showNotification('Stoa', { body, tag })
    return true
  }
  new globalThis.Notification('Stoa', { body, tag })
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/notify.test.js`
Expected: PASS, 7 tests. The `fireNotification` "granted" case takes the constructor fallback because the stub defines no `navigator.serviceWorker`.

Then run: `pnpm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify.js src/lib/__tests__/notify.test.js
git commit -m "feat(nudges): notification wrapper isolating every browser global"
```

---

### Task 4: Store support for nudge fields

`addItem` builds its item field by field and does **not** spread `extra` (`src/lib/store.js:48-61`), so `intervalMin` and `enabled` are silently dropped today. The fields are attached only when an interval is supplied, so ordinary items are not bloated with two null columns.

**Files:**
- Modify: `src/lib/store.js:44-64`
- Test: `src/lib/__tests__/store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `addItem(areaId, title, { intervalMin, enabled })` persists both fields; items created without `intervalMin` carry neither key.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/store.test.js`, inside the existing top-level scope (add a new `describe` at the end of the file):

```js
describe('nudge fields on items', () => {
  beforeEach(reset)

  it('persists intervalMin and enabled when an interval is supplied', () => {
    const n = useStore.getState().addItem('nudges', 'drink water', {
      type: 'timer', intervalMin: 120, enabled: true,
    })
    const stored = useStore.getState().items.find((i) => i.id === n.id)
    expect(stored.intervalMin).toBe(120)
    expect(stored.enabled).toBe(true)
    expect(stored.type).toBe('timer')
  })

  it('defaults a new nudge to switched off', () => {
    const n = useStore.getState().addItem('nudges', 'stand up', { type: 'timer', intervalMin: 45 })
    expect(useStore.getState().items.find((i) => i.id === n.id).enabled).toBe(false)
  })

  it('leaves ordinary items free of nudge fields', () => {
    const it = useStore.getState().addItem('projects', 'ship it')
    const stored = useStore.getState().items.find((i) => i.id === it.id)
    expect('intervalMin' in stored).toBe(false)
    expect('enabled' in stored).toBe(false)
  })

  it('round-trips both fields through a sync merge', () => {
    const n = useStore.getState().addItem('nudges', 'stretch', { type: 'timer', intervalMin: 30 })
    const remote = [{
      kind: 'item', id: n.id, updatedAt: n.updatedAt + 1000, deletedAt: null,
      data: { ...n, enabled: true, intervalMin: 90, updatedAt: n.updatedAt + 1000 },
    }]
    useStore.getState().mergeRemote(remote)
    const merged = useStore.getState().items.find((i) => i.id === n.id)
    expect(merged.enabled).toBe(true)
    expect(merged.intervalMin).toBe(90)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/store.test.js`
Expected: FAIL — `expected undefined to be 120`, because `addItem` drops the fields.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/store.js`, inside `addItem`, add the conditional spread as the last property of the `item` object literal (after `deletedAt: null,`):

```js
        const item = {
          id: uid(),
          areaId,
          bucket: extra.bucket ?? null,
          title: title.trim(),
          details: extra.details ?? '',
          type: extra.type ?? (areaId === 'habits' ? 'habit' : 'task'),
          status: 'open',
          order,
          createdAt: now(),
          updatedAt: now(),
          completedAt: null,
          deletedAt: null,
          // Nudge timers only. Attached conditionally so ordinary items don't
          // all carry two dead columns; merge.js passes the whole `data`
          // object through, so both fields sync with no sync-layer change.
          ...(extra.intervalMin != null && {
            intervalMin: extra.intervalMin,
            enabled: extra.enabled ?? false,
          }),
        }
```

Also extend the module's leading doc comment where it describes Item, adding a line after the existing `Item` description:

```
 *          Nudge timers additionally carry { intervalMin, enabled }.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS, whole suite including the four new store tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.js src/lib/__tests__/store.test.js
git commit -m "feat(nudges): carry intervalMin and enabled through addItem"
```

---

### Task 5: The runner

One interval drives every nudge. Dependencies are injected so the loop is testable under the node environment; the browser wiring that reads `localStorage` is a separate export that tests never call.

**Files:**
- Create: `src/lib/nudgeRunner.js`
- Test: `src/lib/__tests__/nudgeRunner.test.js`

**Interfaces:**
- Consumes: `tickPlan`, `DEFAULT_QUIET` from `src/lib/timers.js`; `fireNotification` from `src/lib/notify.js`.
- Produces:
  - `createRunner({ getNudges, getLastFired, setLastFired, getQuiet, fire, now }) -> { tick(): { fire, anchors } }`
  - `TICK_MS` — `15000`
  - `readLastFired() / writeLastFired(map) / seedAnchor(id) / clearAnchor(id)`
  - `readQuiet() / writeQuiet(quiet)`
  - `startNudges() -> () => void` (cleanup)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/nudgeRunner.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createRunner, TICK_MS } from '../nudgeRunner.js'
import { DEFAULT_QUIET } from '../timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

/** Wires createRunner to plain objects instead of localStorage and the DOM. */
const harness = ({ nudges, lastFired = {}, quiet = OFF, now }) => {
  let anchors = { ...lastFired }
  const fired = []
  const runner = createRunner({
    getNudges: () => nudges,
    getLastFired: () => anchors,
    setLastFired: (next) => { anchors = next },
    getQuiet: () => quiet,
    fire: (body, tag) => { fired.push({ body, tag }); return Promise.resolve(true) },
    now: () => now,
  })
  return { runner, fired, anchors: () => anchors }
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })

describe('createRunner', () => {
  it('ticks every 15 seconds', () => {
    expect(TICK_MS).toBe(15_000)
  })

  it('fires the due nudge with its title as the body and its id as the tag', () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 45 * MIN }, now })
    h.runner.tick()
    expect(h.fired).toEqual([{ body: 'a message', tag: 'a' }])
  })

  it('persists the new anchor so the next tick does not re-fire', () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 45 * MIN }, now })
    h.runner.tick()
    expect(h.anchors()).toEqual({ a: now })
    h.runner.tick()
    expect(h.fired).toHaveLength(1)
  })

  it('writes nothing and fires nothing when no nudge is due', () => {
    const now = at(12)
    const setLastFired = vi.fn()
    const runner = createRunner({
      getNudges: () => [nudge('a', 45)],
      getLastFired: () => ({ a: now - 10 * MIN }),
      setLastFired,
      getQuiet: () => OFF,
      fire: () => Promise.resolve(true),
      now: () => now,
    })
    expect(runner.tick().fire).toEqual([])
    expect(setLastFired).not.toHaveBeenCalled()
  })

  it('advances the anchor without firing during quiet hours', () => {
    const now = at(3)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 90 * MIN }, quiet: DEFAULT_QUIET, now })
    h.runner.tick()
    expect(h.fired).toEqual([])
    expect(h.anchors()).toEqual({ a: now })
  })

  it('preserves anchors of nudges that did not fire', () => {
    const now = at(12)
    const h = harness({
      nudges: [nudge('a', 45), nudge('b', 120)],
      lastFired: { a: now - 46 * MIN, b: now - 10 * MIN },
      now,
    })
    h.runner.tick()
    expect(h.anchors()).toEqual({ a: now, b: now - 10 * MIN })
  })

  it('does not re-fire when the notification itself rejects', async () => {
    const now = at(12)
    let anchors = { a: now - 45 * MIN }
    const runner = createRunner({
      getNudges: () => [nudge('a', 45)],
      getLastFired: () => anchors,
      setLastFired: (next) => { anchors = next },
      getQuiet: () => OFF,
      fire: () => Promise.reject(new Error('blocked')),
      now: () => now,
    })
    expect(() => runner.tick()).not.toThrow()
    await Promise.resolve()
    expect(anchors).toEqual({ a: now })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/nudgeRunner.test.js`
Expected: FAIL — `Cannot find module '../nudgeRunner.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/nudgeRunner.js`:

```js
/**
 * One interval drives every nudge — not one timer per nudge.
 *
 * `createRunner` takes all its dependencies as arguments so the loop can be
 * tested under the node environment with plain objects. The localStorage-backed
 * wiring below it is only reached from `startNudges()`, which tests never call.
 */
import { tickPlan, DEFAULT_QUIET } from './timers.js'
import { fireNotification } from './notify.js'
import { useStore, selectAreaItems } from './store.js'

/** Polling cadence. Correctness comes from timestamp comparison, not this. */
export const TICK_MS = 15_000

export function createRunner({ getNudges, getLastFired, setLastFired, getQuiet, fire, now }) {
  return {
    tick() {
      const nudges = getNudges()
      const plan = tickPlan(nudges, getLastFired(), getQuiet(), now())
      if (Object.keys(plan.anchors).length === 0) return plan
      // Persist BEFORE firing: if `fire` throws or the permission was revoked,
      // the anchor has still moved, so the next tick cannot re-fire in a loop.
      setLastFired({ ...getLastFired(), ...plan.anchors })
      const byId = new Map(nudges.map((n) => [n.id, n]))
      for (const id of plan.fire) {
        Promise.resolve(fire(byId.get(id).title, id)).catch(() => {})
      }
      return plan
    },
  }
}

// ── Device-local storage ────────────────────────────────────────
// Anchors and quiet hours never sync. A synced anchor would mean the phone
// firing a nudge silently suppresses the same nudge on the desktop.

const LAST_KEY = 'stoa.nudge.lastFired'
const QUIET_KEY = 'stoa.nudge.quiet'

const readJson = (key, fallback) => {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}

export const readLastFired = () => readJson(LAST_KEY, {})
export const writeLastFired = (map) => writeJson(LAST_KEY, map)

/** Switching a nudge on starts its interval from now, not from some old anchor. */
export const seedAnchor = (id) => writeLastFired({ ...readLastFired(), [id]: Date.now() })

/** Switching one off drops its anchor, so re-enabling never fires immediately. */
export const clearAnchor = (id) => {
  const next = { ...readLastFired() }
  delete next[id]
  writeLastFired(next)
}

export const readQuiet = () => ({ ...DEFAULT_QUIET, ...readJson(QUIET_KEY, {}) })
export const writeQuiet = (quiet) => writeJson(QUIET_KEY, quiet)

/** Start the single app-wide tick. Returns a cleanup function. */
export function startNudges() {
  const runner = createRunner({
    getNudges: () => selectAreaItems('nudges')(useStore.getState()),
    getLastFired: readLastFired,
    setLastFired: writeLastFired,
    getQuiet: readQuiet,
    fire: fireNotification,
    now: Date.now,
  })
  const id = setInterval(() => runner.tick(), TICK_MS)
  return () => clearInterval(id)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/nudgeRunner.test.js`
Expected: PASS, 7 tests.

Then run: `pnpm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nudgeRunner.js src/lib/__tests__/nudgeRunner.test.js
git commit -m "feat(nudges): single-interval runner with injected dependencies"
```

---

### Task 6: The Nudges view

The last task, and the only one without unit tests — the view uses hooks, and this codebase never renders components in tests (`AreaIcon.test.js` calls them as functions). Verification is the full suite plus `pnpm lint` plus a manual check in the dev server.

**Files:**
- Create: `src/views/Nudges.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `readLastFired`, `seedAnchor`, `clearAnchor`, `readQuiet`, `writeQuiet`, `startNudges` from `src/lib/nudgeRunner.js`; `nextFireAt` from `src/lib/timers.js`; `notifyPermission`, `requestNotifyPermission` from `src/lib/notify.js`; `useStore`, `selectAreaItems` from `src/lib/store.js`.
- Produces: route `/nudges`.

- [ ] **Step 1: Create the view**

Create `src/views/Nudges.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { BellRing, Moon, Plus, Power, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { nextFireAt } from '../lib/timers'
import { notifyPermission, requestNotifyPermission } from '../lib/notify'
import { readLastFired, seedAnchor, clearAnchor, readQuiet, writeQuiet } from '../lib/nudgeRunner'
import AreaIcon from '../components/AreaIcon'

const PRESETS = [15, 30, 45, 60, 120]

const hhmm = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

const toMins = (value) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** "in 42m" / "in 1h 12m" / "any moment now" */
const countdown = (at, now) => {
  if (at == null) return null
  const left = Math.max(0, at - now)
  const mins = Math.round(left / 60_000)
  if (mins <= 0) return 'any moment now'
  if (mins < 60) return `in ${mins}m`
  return `in ${Math.floor(mins / 60)}h ${mins % 60}m`
}

/**
 * Nudges: always-on interval timers. Each fires its own message while Stoa is
 * open. Nothing is logged — these are ambient prompts, not tracked habits.
 */
export default function Nudges() {
  const nudges = useStore(useShallow(selectAreaItems('nudges')))
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)

  const [draft, setDraft] = useState('')
  const [intervalMin, setIntervalMin] = useState(45)
  const [permission, setPermission] = useState(notifyPermission())
  const [quiet, setQuiet] = useState(readQuiet)
  const [now, setNow] = useState(() => Date.now())

  // Re-render once a minute so the countdowns stay honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const saveQuiet = (next) => {
    setQuiet(next)
    writeQuiet(next)
  }

  const add = () => {
    if (!draft.trim()) return
    addItem('nudges', draft, { type: 'timer', intervalMin, enabled: false })
    setDraft('')
  }

  const toggle = async (n) => {
    if (n.enabled) {
      clearAnchor(n.id)
      updateItem(n.id, { enabled: false })
      return
    }
    let perm = notifyPermission()
    if (perm === 'default') {
      perm = await requestNotifyPermission() // must come from this click
      setPermission(perm)
    }
    seedAnchor(n.id)
    updateItem(n.id, { enabled: true })
  }

  const lastFired = readLastFired()

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-o)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="BellRing" /></div>
        <h1>Nudges</h1>
      </div>

      {permission === 'unsupported' && (
        <div className="status-error">
          This browser cannot show notifications. On iPhone, add Stoa to your home
          screen first.
        </div>
      )}
      {permission === 'denied' && (
        <div className="status-error">
          Notifications are blocked. Re-enable them for this site in your browser
          settings — nudges will not fire until you do.
        </div>
      )}

      {nudges.length === 0 && (
        <div className="empty-note">
          A nudge is a message on a repeat.
          <br />Water every 2h, stand up every 45m. Nothing is logged.
        </div>
      )}

      <div className="item-list">
        {nudges.map((n) => {
          const due = countdown(nextFireAt(n, lastFired), now)
          return (
            <div key={n.id} className="item-row nudge-row">
              <button
                className={`nudge-power ${n.enabled ? 'on' : ''}`}
                onClick={() => toggle(n)}
                aria-label={`${n.enabled ? 'Switch off' : 'Switch on'} ${n.title}`}
                aria-pressed={n.enabled}
              >
                <Power size={16} strokeWidth={2.25} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">{n.title}</div>
                <div className="nudge-meta">
                  every {n.intervalMin}m{n.enabled && due ? ` · ${due}` : ''}
                </div>
              </div>
              <button
                className="detail-btn"
                onClick={() => deleteItem(n.id)}
                aria-label={`Delete ${n.title}`}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="add-row">
        <input
          value={draft}
          placeholder="Message to nudge yourself with…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>

      <div className="bucket-tabs">
        {PRESETS.map((m) => (
          <button
            key={m}
            className={`bucket-tab ${intervalMin === m ? 'on' : ''}`}
            onClick={() => setIntervalMin(m)}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="quiet-block">
        <label className="quiet-head">
          <Moon size={15} strokeWidth={1.75} />
          <span>Quiet hours</span>
          <input
            type="checkbox"
            checked={quiet.on}
            onChange={(e) => saveQuiet({ ...quiet, on: e.target.checked })}
          />
        </label>
        <div className="quiet-times">
          <input
            type="time"
            value={hhmm(quiet.startMin)}
            onChange={(e) => saveQuiet({ ...quiet, startMin: toMins(e.target.value) })}
            aria-label="Quiet hours start"
          />
          <span>to</span>
          <input
            type="time"
            value={hhmm(quiet.endMin)}
            onChange={(e) => saveQuiet({ ...quiet, endMin: toMins(e.target.value) })}
            aria-label="Quiet hours end"
          />
        </div>
        <p className="hint">Nudges due in this window are skipped, not stacked up for later.</p>
      </div>
    </div>
  )
}
```

Note `·` rather than a literal middle dot: keeping non-ASCII punctuation out of source avoids any argument with `no-emoji.test.js`.

- [ ] **Step 2: Wire the route and start the runner**

In `src/App.jsx`, add the import beside the other views:

```js
import Nudges from './views/Nudges'
```

add the runner import beside `startSync`:

```js
import { startNudges } from './lib/nudgeRunner'
```

add the effect next to the existing sync effect:

```js
  useEffect(() => startSync(), [])
  useEffect(() => startNudges(), [])
```

and add the route after the journal route:

```jsx
          <Route path="/nudges" element={<Nudges />} />
```

- [ ] **Step 3: Add the styles**

Append to `src/App.css`:

```css
.nudge-power {
  width: 30px; height: 30px; flex: none;
  display: grid; place-items: center;
  border-radius: 8px;
  border: 1px solid var(--surface-3);
  background: transparent;
  color: var(--text-muted);
}
.nudge-power.on { border-color: var(--trim-o); color: var(--trim-o); }
.nudge-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; }

.quiet-block { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--surface-3); }
.quiet-head { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.quiet-head span { flex: 1; }
.quiet-times { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.quiet-times span { font-size: 13px; color: var(--text-muted); }
```

- [ ] **Step 4: Verify**

Run: `pnpm test`
Expected: PASS, whole suite. Critically, `no-emoji.test.js` must pass over the new `.jsx` and `.css`, and `rewards.test.js` / `chart.test.js` must pass **unchanged** — that is the proof this feature did not leak into the daily graph.

Run: `pnpm lint`
Expected: clean.

Run: `pnpm dev`, then in the browser:

1. Go to Areas — Nudges appears with the `BellRing` icon and an amber trim.
2. Add a nudge "test nudge" with the 15m preset. It appears switched off.
3. Switch it on. The permission prompt appears; grant it. The row shows
   `every 15m · in 15m`.
4. Force it overdue rather than waiting. In the console:
   ```js
   const k = 'stoa.nudge.lastFired'
   const m = JSON.parse(localStorage.getItem(k))
   for (const id in m) m[id] = Date.now() - 3600_000
   localStorage.setItem(k, JSON.stringify(m))
   ```
   Within 15 seconds a notification appears, titled "Stoa", with your message as
   the body. Exactly **one** notification, not four — that is catch-up suppression.
5. Switch the nudge off and confirm its id is gone from
   `localStorage.getItem('stoa.nudge.lastFired')`.
6. Set quiet hours to a window containing the current time, switch the nudge back
   on, and repeat step 4. No notification appears, but the anchor in
   `stoa.nudge.lastFired` still advances to roughly now.
7. Reload with the nudge on and confirm it survives — it is an ITEM in IndexedDB,
   while its anchor is in localStorage.

- [ ] **Step 5: Commit**

```bash
git add src/views/Nudges.jsx src/App.jsx src/App.css
git commit -m "feat(nudges): nudges view, route, and app-wide runner"
```

---

## Self-review notes

**Spec coverage.** Area row and `'timers'` kind (Task 1) · `route` field improvement (Task 1) · `intervalMin`/`enabled` on ITEM (Task 4) · no new log kind or graph band (verified by the unchanged `rewards`/`chart` tests in Task 6) · device-local anchors and quiet hours (Task 5) · wall-clock anchoring, catch-up suppression, quiet hours wrapping midnight (Task 2) · 15-second tick (Task 5) · enabling seeds the anchor, disabling clears it (Tasks 5 and 6) · permission on first toggle-on from a user gesture (Task 6) · all five failure modes surfaced in the view (Task 6) · `tag` set to the item id (Task 3) · every test listed in the spec (Tasks 2, 3, 5).

**Two deliberate deviations from the spec**, both noted at their task:
1. `nextWakeAt` is cut in favour of `nextFireAt`. The runner polls on a fixed cadence, so nothing consumed a global wake time, while the view needs a per-nudge countdown.
2. Quiet-hours controls live in the Nudges view, not the Settings page. The spec left the location unstated and its module list named only `Nudges.jsx`; the Settings page is titled "Sync" and is about device linking.

**One gap the spec missed**, now Task 4: `addItem` does not spread `extra`, so `intervalMin`/`enabled` would have been dropped on create.

**One known limitation, stated rather than hidden.** A nudge's interval is fixed
at creation — the preset row sets it for the next nudge you add, and there is no
edit-interval control. Changing one means deleting and re-adding. Adding inline
interval editing is a small follow-up; it is left out here to keep Task 6, the
only untested task, as small as possible.
