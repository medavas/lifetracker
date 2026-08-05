# Daily Stack + Practice Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's flat single-series activity chart with a four-band stacked bar (Journal/Diet/Fitness/Habits) plus a 5-week presence grid, both derived from existing data.

**Architecture:** Four area rows in the registry gain a `daily` field naming their stack order and palette slot. Two pure functions in `rewards.js` turn LOGs and NOTEs into per-day band counts (magnitude) and per-day booleans over a 5x7 calendar-week window (presence). A third pure function in a new `chart.js` turns band counts into SVG rectangle geometry. The two components are thin maps over those outputs. No new primitive, no schema change, no migration.

**Tech Stack:** React 19, zustand 5, vitest 2 (node environment), plain SVG, CSS custom properties.

Spec: `docs/superpowers/specs/2026-08-04-daily-stack-practice-grid-design.md`
Branch: `daily-stack-practice-grid` (already created; the spec commit is `7e0f98c`)

## Global Constraints

- **No emoji, dingbats, or arrow glyphs anywhere under `src/`.** `src/lib/__tests__/no-emoji.test.js` scans every `.js/.jsx/.css/.html` file and fails on codepoints in `U+1F000-1FAFF`, `U+2600-27BF`, `U+2190-21FF`, `U+2B00-2BFF`, `U+FE0F`. Write `Mon` not an arrow, `x` not a checkmark.
- **Test environment is `node`, not jsdom.** `vitest.config.js` sets `environment: 'node'` and `include: ['src/**/*.test.js', 'server/**/*.test.js']`. Test files must end in `.test.js` (never `.test.jsx`). Components that call hooks cannot be unit-tested here — that is why the geometry lives in a pure helper.
- **Colors come from CSS custom properties only.** Bands use `var(--series-N)`; empty state uses `var(--surface-3)`. Never hardcode a hex value in a component.
- **Identity is icon + name first, color second.** Any legend entry shows `<AreaIcon>` and the area name alongside its swatch. This rule is stated in `src/data/areas.js`.
- **Tombstones are never counted.** Every selector filters `!deletedAt`. A missing `deletedAt` field counts as "not deleted" (legacy records predate the field).
- **Run all tests with `pnpm test`** (`vitest run`). Lint with `pnpm lint` (oxlint).

---

### Task 1: Registry config — `daily` field and trim realignment

Adds the `daily` descriptor to the four daily-practice areas and realigns trim colors so an area's nav color matches its band color.

**Files:**
- Modify: `src/data/areas.js`
- Test: `src/data/__tests__/areas.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AREAS[].daily?: { order: number, series: number }` — present on exactly four rows (`journal`, `diet`, `fitness`, `habits`). `order` is 1..4, bottom-to-top in the stacked bar and top-to-bottom in a grid cell. `series` is the `--series-N` index.
  - `DAILY_BANDS: Array<Area>` — the four daily areas pre-sorted by `daily.order`. Tasks 2, 4, 5, and 6 all iterate this.

**Why `learnings` moves to `o`:** the existing test asserts each trim is used at most twice. Moving `journal` to `b` would make `b` appear three times (projects, learnings, journal). `o` is currently unused by any area, so moving `learnings` there restores the invariant and uses the full six-token palette.

- [ ] **Step 1: Write the failing tests**

Replace the `EXPECTED` map at the top of `src/data/__tests__/areas.test.js` with the post-realignment values, and add a new `describe` block. The existing `EXPECTED` map becomes:

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
}
```

Change the import line at the top of the file to also pull in `DAILY_BANDS`:

```js
import { AREAS, DAILY_BANDS } from '../areas'
```

Append this block inside the file, after the existing `describe('area registry', ...)` block:

```js
describe('daily bands', () => {
  it('marks exactly the four daily-practice areas', () => {
    expect(AREAS.filter((a) => a.daily).map((a) => a.id).sort()).toEqual(
      ['diet', 'fitness', 'habits', 'journal'],
    )
  })

  it('assigns orders 1..4 with no duplicates', () => {
    const orders = AREAS.filter((a) => a.daily).map((a) => a.daily.order).sort()
    expect(orders).toEqual([1, 2, 3, 4])
  })

  it('assigns a distinct series slot to each band', () => {
    const series = AREAS.filter((a) => a.daily).map((a) => a.daily.series)
    expect(new Set(series).size).toBe(series.length)
  })

  it('exposes DAILY_BANDS sorted bottom-to-top', () => {
    expect(DAILY_BANDS.map((a) => a.id)).toEqual(['journal', 'diet', 'fitness', 'habits'])
  })

  it('gives every band a trim matching its own identity color family', () => {
    // journal blue, diet green, fitness amber, habits red - nav and chart agree
    const trims = Object.fromEntries(DAILY_BANDS.map((a) => [a.id, a.trim]))
    expect(trims).toEqual({ journal: 'b', diet: 'g', fitness: 'y', habits: 'r' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/data/__tests__/areas.test.js`
Expected: FAIL. `DAILY_BANDS` is not exported (import resolves to `undefined`, so `DAILY_BANDS.map` throws `TypeError`), and the trim assertions fail because `fitness` is still `r`, `habits` still `y`, `journal` still `v`, `learnings` still `b`.

- [ ] **Step 3: Update the registry**

In `src/data/areas.js`, change four `trim` values and add `daily` to four rows. The full set of edits:

- `fitness`: `trim: 'r'` becomes `trim: 'y'`, and add `daily: { order: 3, series: 4 }`
- `diet`: `trim` stays `'g'`, add `daily: { order: 2, series: 3 }`
- `habits`: `trim: 'y'` becomes `trim: 'r'`, and add `daily: { order: 4, series: 2 }`
- `journal`: `trim: 'v'` becomes `trim: 'b'`, and add `daily: { order: 1, series: 1 }`
- `learnings`: `trim: 'b'` becomes `trim: 'o'`

So, for example, the `journal` row becomes:

```js
  {
    id: 'journal', name: 'Journal', icon: 'NotebookPen', kind: 'journal',
    trim: 'b',
    daily: { order: 1, series: 1 },
    keywords: ['journal', 'today i', 'feeling', 'grateful', 'reflect'],
    buckets: [],
  },
```

Extend the header docblock so the new field is documented in the same place as `trim`. Insert after the existing paragraph about `trim`:

```js
/**
 * `daily` marks an area as part of the daily practice rendered by DailyStack
 * and PracticeGrid. `order` is 1..4, bottom-to-top in the stacked bar and
 * top-to-bottom in a grid cell. `series` indexes the CVD-validated
 * --series-* palette in index.css. Areas without `daily` are excluded from
 * both views: finishing a bill is real work but is not a daily rhythm.
 * Adding a fifth daily area means adding this field plus a --series-5 check;
 * no component changes.
 */
```

Append the derived export at the bottom of the file, below `areaById`:

```js
/** The daily-practice areas, pre-sorted bottom-to-top for the stack. */
export const DAILY_BANDS = AREAS.filter((a) => a.daily).sort(
  (a, b) => a.daily.order - b.daily.order,
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/data/__tests__/areas.test.js`
Expected: PASS, all tests in the file including the pre-existing `uses each trim color at most twice`.

- [ ] **Step 5: Run the full suite to catch trim fallout**

Run: `pnpm test`
Expected: PASS. Nothing else asserts on trim values, but this confirms it.

- [ ] **Step 6: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js
git commit -m "feat(areas): mark the four daily-practice bands, realign trims to match"
```

---

### Task 2: `dailyActivity` — per-day band counts

The magnitude data behind the stacked bar. Config-driven so a fifth daily area needs no change here.

**Files:**
- Modify: `src/lib/rewards.js`
- Test: `src/lib/__tests__/rewards.test.js`

**Interfaces:**
- Consumes: `DAILY_BANDS` from Task 1.
- Produces:
  - `bandCounts(logs, notes, date) -> { [areaId]: number }` — one key per daily band, always all four present.
  - `dailyActivity(logs, notes, n = 7) -> Array<{ date: string, bands: { [areaId]: number }, total: number }>` — oldest first, every day in the window present including zero days.

**Counting rules,** switched on the area's existing `kind` so no new config is needed:
- `kind === 'journal'` — NOTEs with that `areaId` and no `itemId`, bucketed by local day from `createdAt`.
- `kind === 'habits'` — LOGs with `kind: 'habit-check'` and that `areaId`.
- anything else — LOGs with `kind: 'complete'` and that `areaId`.

Journal counts NOTEs rather than the `kind: 'journal'` day-marker LOG because `addNote` writes at most one marker per day (`src/lib/store.js:158`); counting markers would cap the journal band at 1 while habits reach 6+, rendering journal as a permanent sliver.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/rewards.test.js`. Note the existing `log()` helper at the top of that file already supplies sane defaults; add a `note()` helper beside it.

First, extend the import line at the top of the file:

```js
import { computePoints, bandCounts, dailyActivity } from '../rewards.js'
```

Then add this helper next to the existing `log` helper:

```js
const note = (over) => ({ id: Math.random().toString(), areaId: 'journal', itemId: null, text: 't', createdAt: Date.parse('2026-08-04T09:00:00'), updatedAt: 1, deletedAt: null, ...over })
```

Then append these blocks:

```js
describe('bandCounts', () => {
  const D = '2026-08-04'

  it('returns a zero for every band when nothing happened', () => {
    expect(bandCounts([], [], D)).toEqual({ journal: 0, diet: 0, fitness: 0, habits: 0 })
  })

  it('counts journal NOTEs, not the day-marker log', () => {
    const notes = [note({}), note({}), note({})]
    const logs = [log({ kind: 'journal', areaId: 'journal', date: D })]
    expect(bandCounts(logs, notes, D).journal).toBe(3)
  })

  it('ignores per-item notes and notes from other areas', () => {
    const notes = [
      note({ itemId: 'i1' }),
      note({ areaId: 'fitness' }),
      note({}),
    ]
    expect(bandCounts([], notes, D).journal).toBe(1)
  })

  it('counts completes per area without cross-contamination', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: D }),
      log({ kind: 'complete', areaId: 'diet', date: D }),
      log({ kind: 'complete', areaId: 'fitness', date: D }),
      log({ kind: 'complete', areaId: 'finance', date: D }),
    ]
    const b = bandCounts(logs, [], D)
    expect(b.diet).toBe(2)
    expect(b.fitness).toBe(1)
  })

  it('counts habit-checks into the habits band', () => {
    const logs = [
      log({ kind: 'habit-check', areaId: 'habits', date: D }),
      log({ kind: 'habit-check', areaId: 'habits', date: D }),
    ]
    expect(bandCounts(logs, [], D).habits).toBe(2)
  })

  it('excludes tombstoned logs and notes', () => {
    const logs = [log({ kind: 'complete', areaId: 'diet', date: D, deletedAt: 5 })]
    const notes = [note({ deletedAt: 5 })]
    const b = bandCounts(logs, notes, D)
    expect(b.diet).toBe(0)
    expect(b.journal).toBe(0)
  })

  it('buckets notes by local day, matching log date keys', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T23:30:00') })]
    expect(bandCounts([], notes, D).journal).toBe(1)
    expect(bandCounts([], notes, '2026-08-05').journal).toBe(0)
  })
})

describe('dailyActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns n days oldest-first ending today', () => {
    const out = dailyActivity([], [], 7)
    expect(out).toHaveLength(7)
    expect(out[0].date).toBe('2026-07-29')
    expect(out[6].date).toBe('2026-08-04')
  })

  it('includes zero days rather than skipping them', () => {
    const out = dailyActivity([log({ kind: 'complete', areaId: 'diet', date: '2026-08-04' })], [], 7)
    expect(out).toHaveLength(7)
    expect(out[0]).toEqual({ date: '2026-07-29', bands: { journal: 0, diet: 0, fitness: 0, habits: 0 }, total: 0 })
  })

  it('sums the four bands into total', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-04' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-04' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-04' }),
    ]
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    const today = dailyActivity(logs, notes, 7)[6]
    expect(today.bands).toEqual({ journal: 1, diet: 1, fitness: 0, habits: 2 })
    expect(today.total).toBe(4)
  })

  it('ignores activity in non-daily areas', () => {
    const logs = [log({ kind: 'complete', areaId: 'finance', date: '2026-08-04' })]
    expect(dailyActivity(logs, [], 7)[6].total).toBe(0)
  })
})
```

Update the vitest import at the top of the file so the new hooks and `vi` are available:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: FAIL with `bandCounts is not a function` / `dailyActivity is not a function`.

- [ ] **Step 3: Implement the functions**

In `src/lib/rewards.js`, add the import at the top of the file:

```js
import { DAILY_BANDS } from '../data/areas.js'
```

Then replace the existing `activityByDay` function (lines 59-67, including its docblock) with:

```js
/** Local day key for a note's createdAt timestamp, matching LOG `date` values. */
const dayKeyOf = (ts) => todayKey(new Date(ts))

/**
 * Counts for one day, one key per daily band. Switched on the area's `kind`
 * so a fifth daily area needs no change here.
 *
 * Journal counts NOTEs, not the `kind:'journal'` day-marker log: the store
 * writes at most one marker per day, which would cap the band at 1 while
 * habits reach 6+, making journaling render as a permanent sliver.
 */
export function bandCounts(logs, notes, date) {
  const live = logs.filter((l) => !l.deletedAt)
  const liveNotes = notes.filter((n) => !n.deletedAt)
  const out = {}
  for (const area of DAILY_BANDS) {
    if (area.kind === 'journal') {
      out[area.id] = liveNotes.filter(
        (n) => n.areaId === area.id && !n.itemId && dayKeyOf(n.createdAt) === date,
      ).length
    } else if (area.kind === 'habits') {
      out[area.id] = live.filter(
        (l) => l.kind === 'habit-check' && l.areaId === area.id && l.date === date,
      ).length
    } else {
      out[area.id] = live.filter(
        (l) => l.kind === 'complete' && l.areaId === area.id && l.date === date,
      ).length
    }
  }
  return out
}

/**
 * Band counts for the last n days, oldest first. Every day in the window is
 * present, including days with no activity, so the chart keeps a stable width.
 */
export function dailyActivity(logs, notes, n = 7) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const date = daysAgoKey(i)
    const bands = bandCounts(logs, notes, date)
    const total = Object.values(bands).reduce((s, v) => s + v, 0)
    out.push({ date, bands, total })
  }
  return out
}
```

Leave `computePoints`, `habitStreak`, `levelForPoints`, `levelProgress`, `pointsForLevel`, `todayKey`, and `daysAgoKey` untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: PASS.

- [ ] **Step 5: Confirm the suite is still green**

Run: `pnpm test`
Expected: PASS. No test imports `activityByDay`, so removing it breaks no suite.

Be aware: `src/views/Dashboard.jsx:5` still imports `activityByDay`, so the **dev build is broken from here until Task 5 Step 4** rewires it. This is expected and invisible to the test suite. Do not try to "fix" it inside Tasks 3 or 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rewards.js src/lib/__tests__/rewards.test.js
git commit -m "feat(rewards): per-day band counts for the daily stack"
```

---

### Task 3: `dailyPresence` — the 5x7 calendar window

The presence data behind the grid. Thresholds Task 2's counts at `> 0` over calendar weeks rather than a rolling window.

**Files:**
- Modify: `src/lib/rewards.js`
- Test: `src/lib/__tests__/rewards.test.js`

**Interfaces:**
- Consumes: `bandCounts` from Task 2.
- Produces:
  - `startOfWeekKey(d = new Date()) -> string` — the Monday of `d`'s week as `YYYY-MM-DD`, local time.
  - `dailyPresence(logs, notes, weeks = 5) -> Array<Array<{ date: string, bands: { [areaId]: boolean }, future: boolean }>>` — outer array is weeks oldest-first, inner is Monday..Sunday.

**Week alignment:** Monday-start, local time. `getDay()` returns 0 for Sunday, so the offset back to Monday is `(getDay() + 6) % 7`. The window is the current calendar week plus the four preceding it, so it is always exactly 5x7 and the oldest week drops off as a new one begins. Days after today carry `future: true` and render as empty outline, not as missed days.

**Date parsing:** always build a `Date` from a key with `new Date(key + 'T00:00:00')`. Bare `new Date('2026-08-04')` parses as UTC midnight and shifts a day in negative-offset timezones. `src/components/ActivityChart.jsx:17` already uses the safe form.

- [ ] **Step 1: Write the failing tests**

Extend the import line in `src/lib/__tests__/rewards.test.js`:

```js
import { computePoints, bandCounts, dailyActivity, startOfWeekKey, dailyPresence } from '../rewards.js'
```

Append:

```js
describe('startOfWeekKey', () => {
  it('returns the same day for a Monday', () => {
    expect(startOfWeekKey(new Date('2026-08-03T12:00:00'))).toBe('2026-08-03')
  })
  it('walks back to Monday from midweek', () => {
    expect(startOfWeekKey(new Date('2026-08-04T12:00:00'))).toBe('2026-08-03')
  })
  it('treats Sunday as the end of its week, not the start', () => {
    expect(startOfWeekKey(new Date('2026-08-09T12:00:00'))).toBe('2026-08-03')
  })
})

describe('dailyPresence', () => {
  // 2026-08-04 is a Tuesday; its week starts Mon 2026-08-03.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns exactly 5 weeks of 7 days', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid).toHaveLength(5)
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it('starts four Mondays back and ends on the current week Sunday', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid[0][0].date).toBe('2026-07-06')
    expect(grid[4][0].date).toBe('2026-08-03')
    expect(grid[4][6].date).toBe('2026-08-09')
  })

  it('flags days after today as future', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid[4][0].future).toBe(false) // Mon 08-03
    expect(grid[4][1].future).toBe(false) // Tue 08-04, today
    expect(grid[4][2].future).toBe(true)  // Wed 08-05
    expect(grid[0][0].future).toBe(false)
  })

  it('thresholds counts to booleans', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-03' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-03' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-03' }),
    ]
    const cell = dailyPresence(logs, [], 5)[4][0]
    expect(cell.bands).toEqual({ journal: false, diet: true, fitness: false, habits: true })
  })

  it('puts a Sunday and the following Monday in different weeks', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-02' }), // Sunday
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-03' }), // Monday
    ]
    const grid = dailyPresence(logs, [], 5)
    expect(grid[3][6].date).toBe('2026-08-02')
    expect(grid[3][6].bands.diet).toBe(true)
    expect(grid[4][0].bands.diet).toBe(true)
    expect(grid[3][0].bands.diet).toBe(false)
  })

  it('excludes tombstoned records', () => {
    const logs = [log({ kind: 'complete', areaId: 'diet', date: '2026-08-03', deletedAt: 5 })]
    expect(dailyPresence(logs, [], 5)[4][0].bands.diet).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: FAIL with `startOfWeekKey is not a function` / `dailyPresence is not a function`.

- [ ] **Step 3: Implement the functions**

Append to `src/lib/rewards.js`, after `dailyActivity`:

```js
/** The Monday of d's week, as a local YYYY-MM-DD key. */
export function startOfWeekKey(d = new Date()) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return todayKey(x)
}

/**
 * Presence booleans over a rolling window of `weeks` calendar weeks ending
 * with the current one. Outer array is weeks oldest-first, inner is Mon..Sun,
 * so the block is always exactly weeks x 7 and the oldest week drops off as a
 * new one begins. Days after today are flagged `future` so the grid can render
 * them as empty rather than as missed.
 */
export function dailyPresence(logs, notes, weeks = 5) {
  const today = todayKey()
  const first = new Date(startOfWeekKey() + 'T00:00:00')
  first.setDate(first.getDate() - (weeks - 1) * 7)

  const grid = []
  for (let w = 0; w < weeks; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(first)
      cell.setDate(first.getDate() + w * 7 + d)
      const date = todayKey(cell)
      const counts = bandCounts(logs, notes, date)
      const bands = {}
      for (const id of Object.keys(counts)) bands[id] = counts[id] > 0
      row.push({ date, bands, future: date > today })
    }
    grid.push(row)
  }
  return grid
}
```

`date > today` is a safe comparison because both are zero-padded `YYYY-MM-DD`, which sorts lexicographically the same as chronologically.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/__tests__/rewards.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rewards.js src/lib/__tests__/rewards.test.js
git commit -m "feat(rewards): 5x7 calendar-week presence grid data"
```

---

### Task 4: `stackGeometry` — SVG rectangle math as a pure function

The stacked bar's layout math lives outside the component so it can be tested in the node environment. The component becomes a dumb map over this output.

**Files:**
- Create: `src/lib/chart.js`
- Test: `src/lib/__tests__/chart.test.js`

**Interfaces:**
- Consumes: `dailyActivity` output shape from Task 2; `DAILY_BANDS` from Task 1.
- Produces:
  - `stackGeometry(days, bands, opts) -> Array<{ date, colX, colW, x, w, total, segments }>` where `segments` is `Array<{ areaId: string, series: number, count: number, y: number, h: number }>` ordered bottom-to-top.
  - `opts` defaults to `{ width: 320, height: 120, gap: 10, pad: 4 }`.

`colX`/`colW` describe the full-width invisible hit target for a day; `x`/`w` describe the visible bar inside it. This mirrors the pattern already in `ActivityChart.jsx`, where the hit target is deliberately wider than the mark.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/chart.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { stackGeometry } from '../chart.js'
import { DAILY_BANDS } from '../../data/areas.js'

const day = (date, bands) => ({
  date,
  bands: { journal: 0, diet: 0, fitness: 0, habits: 0, ...bands },
  total: Object.values({ journal: 0, diet: 0, fitness: 0, habits: 0, ...bands }).reduce((s, v) => s + v, 0),
})

const OPTS = { width: 320, height: 120, gap: 10, pad: 4 }

describe('stackGeometry', () => {
  it('produces one column per day', () => {
    const days = [day('2026-08-01', {}), day('2026-08-02', {}), day('2026-08-03', {})]
    expect(stackGeometry(days, DAILY_BANDS, OPTS)).toHaveLength(3)
  })

  it('gives a zero day no segments', () => {
    const out = stackGeometry([day('2026-08-01', {})], DAILY_BANDS, OPTS)
    expect(out[0].segments).toEqual([])
    expect(out[0].total).toBe(0)
  })

  it('omits zero-count bands from a non-empty day', () => {
    const out = stackGeometry([day('2026-08-01', { diet: 2 })], DAILY_BANDS, OPTS)
    expect(out[0].segments.map((s) => s.areaId)).toEqual(['diet'])
  })

  it('orders segments bottom-to-top by band order', () => {
    const d = day('2026-08-01', { journal: 1, diet: 1, fitness: 1, habits: 1 })
    const segs = stackGeometry([d], DAILY_BANDS, OPTS)[0].segments
    expect(segs.map((s) => s.areaId)).toEqual(['journal', 'diet', 'fitness', 'habits'])
    // Larger y is lower on screen in SVG, so journal must sit lowest.
    for (let i = 1; i < segs.length; i++) expect(segs[i].y).toBeLessThan(segs[i - 1].y)
  })

  it('stacks segments flush with no gaps between them', () => {
    const d = day('2026-08-01', { journal: 1, habits: 3 })
    const segs = stackGeometry([d], DAILY_BANDS, OPTS)[0].segments
    expect(segs[0].y + segs[0].h).toBeCloseTo(OPTS.height)
    expect(segs[1].y + segs[1].h).toBeCloseTo(segs[0].y)
  })

  it('scales the busiest day to the full plot height', () => {
    const days = [day('2026-08-01', { diet: 1 }), day('2026-08-02', { habits: 4 })]
    const out = stackGeometry(days, DAILY_BANDS, OPTS)
    const tallest = out[1].segments[0]
    expect(tallest.h).toBeCloseTo(OPTS.height - 14)
    expect(out[0].segments[0].h).toBeCloseTo((OPTS.height - 14) / 4)
  })

  it('carries the series slot and count through for rendering', () => {
    const segs = stackGeometry([day('2026-08-01', { habits: 2 })], DAILY_BANDS, OPTS)[0].segments
    expect(segs[0]).toMatchObject({ areaId: 'habits', series: 2, count: 2 })
  })

  it('keeps the hit target wider than the visible bar', () => {
    const out = stackGeometry([day('2026-08-01', { diet: 1 })], DAILY_BANDS, OPTS)
    expect(out[0].w).toBeLessThan(out[0].colW)
    expect(out[0].x).toBeGreaterThan(out[0].colX)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/__tests__/chart.test.js`
Expected: FAIL with `Failed to resolve import "../chart.js"`.

- [ ] **Step 3: Implement `stackGeometry`**

Create `src/lib/chart.js`:

```js
/**
 * Layout math for the daily stacked bar, kept out of the component so it can
 * be tested: vitest runs in a node environment with no DOM, so a component
 * that calls hooks cannot be exercised directly.
 *
 * SVG y grows downward, so segments are laid out from the baseline upward and
 * a smaller y means higher on screen.
 */

/** Height reserved below the plot for weekday labels. */
const LABEL_H = 14

export function stackGeometry(days, bands, opts = {}) {
  const { width = 320, height = 120, gap = 10, pad = 4 } = opts
  const plotH = height - LABEL_H
  const colW = (width - pad * 2) / Math.max(1, days.length)
  const max = Math.max(1, ...days.map((d) => d.total))

  return days.map((d, i) => {
    const colX = pad + i * colW
    let y = height
    const segments = []
    for (const band of bands) {
      const count = d.bands[band.id] || 0
      if (count === 0) continue
      const h = (count / max) * plotH
      y -= h
      segments.push({ areaId: band.id, series: band.daily.series, count, y, h })
    }
    return {
      date: d.date,
      colX,
      colW,
      x: colX + gap / 2,
      w: Math.max(1, colW - gap),
      total: d.total,
      segments,
    }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/__tests__/chart.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chart.js src/lib/__tests__/chart.test.js
git commit -m "feat(chart): pure stacked-bar geometry helper"
```

---

### Task 5: `DailyStack` component, replacing `ActivityChart`

**Files:**
- Create: `src/components/DailyStack.jsx`
- Delete: `src/components/ActivityChart.jsx`
- Modify: `src/views/Dashboard.jsx:5,7,80-83`
- Modify: `src/App.css:240-253` (the `Chart` section)

**Interfaces:**
- Consumes: `dailyActivity` (Task 2), `stackGeometry` (Task 4), `DAILY_BANDS` (Task 1).
- Produces: `<DailyStack data={...} />` where `data` is `dailyActivity` output. Task 6 renders below it inside the Dashboard.

`ActivityChart.jsx` and `activityByDay` are removed. `Dashboard.jsx` is the sole consumer of both (verified: `grep -rn "ActivityChart\|activityByDay" src/`), and no test imports either, so both removals are clean.

**No component unit test.** `DailyStack` calls `useState`, and calling it as a plain function outside a renderer throws. The existing `AreaIcon.test.js` only works because that component is hook-free. All the logic worth testing is already covered by Tasks 2 and 4; the component is a map over their output. Verification is the manual step below. Adding jsdom to make components testable is a reasonable follow-up but is out of scope here.

- [ ] **Step 1: Delete the old chart and its data function**

```bash
git rm src/components/ActivityChart.jsx
```

In `src/lib/rewards.js`, confirm `activityByDay` is already gone (it was replaced in Task 2, Step 3). If any remnant remains, remove it.

- [ ] **Step 2: Create the component**

Create `src/components/DailyStack.jsx`:

```jsx
import { useState } from 'react'
import { DAILY_BANDS } from '../data/areas'
import { stackGeometry } from '../lib/chart'
import AreaIcon from './AreaIcon'

const W = 320
const H = 120

/**
 * Daily practice, stacked by area. Four series means the title can no longer
 * name the data, so this chart carries a legend; identity there is icon and
 * name first, with color as reinforcement.
 *
 * Geometry lives in lib/chart.js so it can be unit-tested without a DOM.
 */
export default function DailyStack({ data }) {
  const [tip, setTip] = useState(null)
  const cols = stackGeometry(data, DAILY_BANDS, { width: W, height: H })

  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label="Daily practice, last 7 days by area">
        {cols.map((c, i) => (
          <g key={c.date}>
            <rect
              x={c.colX} y={0} width={c.colW} height={H + 18} fill="transparent"
              onMouseEnter={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100, c })}
              onMouseLeave={() => setTip(null)}
              onTouchStart={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100, c })}
            />
            {c.total === 0 && (
              <rect x={c.x} y={H - 2} width={c.w} height={2} rx={1} fill="var(--surface-3)" pointerEvents="none" />
            )}
            {c.segments.map((s) => (
              <rect
                key={s.areaId}
                x={c.x} y={s.y} width={c.w} height={s.h}
                fill={`var(--series-${s.series})`}
                opacity={tip && tip.i !== i ? 0.55 : 1}
                pointerEvents="none"
              />
            ))}
            <text
              x={c.colX + c.colW / 2} y={H + 14} textAnchor="middle"
              fontSize="10" fill="var(--text-muted)"
            >
              {dayLabel(c.date)}
            </text>
          </g>
        ))}
      </svg>

      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x}%`, top: 0 }}>
          <b>{new Date(tip.c.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>
          {DAILY_BANDS.map((b) => (
            <div key={b.id} className="tip-row">
              <span className="tip-dot" style={{ background: `var(--series-${b.daily.series})` }} />
              {b.name}
              <b>{data[tip.i].bands[b.id]}</b>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {DAILY_BANDS.map((b) => (
          <span key={b.id} className="legend-item">
            <span className="legend-swatch" style={{ background: `var(--series-${b.daily.series})` }} />
            <AreaIcon name={b.icon} size={13} />
            {b.name}
          </span>
        ))}
      </div>

      <details className="data-toggle">
        <summary>View data</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              {DAILY_BANDS.map((b) => <th key={b.id}>{b.name}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                {DAILY_BANDS.map((b) => <td key={b.id}>{d.bands[b.id]}</td>)}
                <td>{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
```

- [ ] **Step 3: Add the styles**

In `src/App.css`, inside the `Chart` section (after the `.chart-tip b` rule near line 249), add:

```css
.chart-tip .tip-row { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.chart-tip .tip-row b { display: inline; margin-left: auto; }
.tip-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-secondary); }
.legend-swatch { width: 9px; height: 9px; border-radius: 2px; flex: none; }
```

- [ ] **Step 4: Wire it into the Dashboard**

In `src/views/Dashboard.jsx`:

Change the rewards import on line 5 from `activityByDay` to `dailyActivity`:

```jsx
import { levelForPoints, levelProgress, habitStreak, dailyActivity, todayKey } from '../lib/rewards'
```

Change the component import on line 7:

```jsx
import DailyStack from '../components/DailyStack'
```

Add a `notes` selector beside the existing `logs` one (near line 12):

```jsx
  const notes = useStore((s) => s.notes)
```

Replace the chart block at lines 80-83:

```jsx
          <div className="section-label">Last 7 days</div>
          <div className="card">
            <DailyStack data={dailyActivity(logs, notes, 7)} />
          </div>
```

- [ ] **Step 5: Run the full suite and lint**

Run: `pnpm test`
Expected: PASS, all files.

Run: `pnpm lint`
Expected: no new errors. In particular the no-emoji test must still pass — the component contains no dingbats or arrows.

- [ ] **Step 6: Verify in the running app**

Run: `pnpm dev`, open the Dashboard.
Expected: the "Last 7 days" card shows a four-color stacked bar with a legend beneath it. Hovering a day shows a tooltip listing all four band counts. "View data" expands to a table with a column per band. Days with no activity show a thin baseline stub rather than nothing.

Check a habit off in "Today's keystones" and confirm the red band on today's bar grows. Write a journal entry and confirm the blue band grows.

- [ ] **Step 7: Commit**

```bash
git add -A src/components src/views/Dashboard.jsx src/App.css
git commit -m "feat(dashboard): stacked daily-practice chart replaces flat activity bar"
```

---

### Task 6: `PracticeGrid` component

**Files:**
- Create: `src/components/PracticeGrid.jsx`
- Modify: `src/views/Dashboard.jsx` (add below the chart card)
- Modify: `src/App.css` (new section after `Chart`)

**Interfaces:**
- Consumes: `dailyPresence` (Task 3), `DAILY_BANDS` (Task 1).
- Produces: `<PracticeGrid weeks={...} />` where `weeks` is `dailyPresence` output.

Constant cell height is the whole point: the grid reads as texture, so gaps and runs are visible at a glance. Magnitude lives on the chart above it. Future days in the current week render as an empty outline, not as missed days.

Like `DailyStack`, this uses `useState` and so cannot be unit-tested in the node environment; `dailyPresence` carries the test weight.

- [ ] **Step 1: Create the component**

Create `src/components/PracticeGrid.jsx`:

```jsx
import { useState } from 'react'
import { DAILY_BANDS } from '../data/areas'

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Five calendar weeks of daily practice as presence, not magnitude: every cell
 * is the same height, four fixed slots, lit or dim. Constant height is the
 * point - the block reads as texture, so gaps and runs are visible at a
 * glance. Magnitude lives on DailyStack above.
 */
export default function PracticeGrid({ weeks }) {
  const [tip, setTip] = useState(null)

  const cellLabel = (cell) => {
    const on = DAILY_BANDS.filter((b) => cell.bands[b.id]).map((b) => b.name)
    return on.length ? on.join(', ') : 'nothing logged'
  }

  return (
    <div className="chart-wrap">
      <div className="practice-grid" role="img" aria-label="Daily practice, last 5 weeks">
        {DAY_INITIALS.map((d, i) => (
          <div key={i} className="pg-head">{d}</div>
        ))}
        {weeks.map((week) =>
          week.map((cell) => (
            <div
              key={cell.date}
              className={`pg-cell ${cell.future ? 'future' : ''}`}
              onMouseEnter={() => setTip(cell)}
              onMouseLeave={() => setTip(null)}
              onTouchStart={() => setTip(cell)}
            >
              {DAILY_BANDS.map((b) => (
                <span
                  key={b.id}
                  className="pg-slot"
                  style={cell.bands[b.id] ? { background: `var(--series-${b.daily.series})` } : undefined}
                />
              ))}
            </div>
          )),
        )}
      </div>

      {tip && (
        <div className="pg-caption">
          {new Date(tip.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' - '}
          {tip.future ? 'not yet' : cellLabel(tip)}
        </div>
      )}

      <details className="data-toggle">
        <summary>View data</summary>
        <table>
          <thead>
            <tr><th>Day</th>{DAILY_BANDS.map((b) => <th key={b.id}>{b.name}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.flat().filter((c) => !c.future).map((c) => (
              <tr key={c.date}>
                <td>{c.date}</td>
                {DAILY_BANDS.map((b) => <td key={b.id}>{c.bands[b.id] ? 'yes' : 'no'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Add the styles**

In `src/App.css`, add a new section immediately after the `Chart` section (after the `.data-toggle td, .data-toggle th` rule):

```css
/* ── Practice grid ───────────────────────────────────────── */
.practice-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.pg-head { font-size: 10px; color: var(--text-muted); text-align: center; margin-bottom: 2px; }
.pg-cell {
  display: flex; flex-direction: column; gap: 1px;
  border-radius: 3px; overflow: hidden; cursor: default;
}
.pg-slot { display: block; height: 6px; background: var(--surface-3); }
.pg-cell.future .pg-slot { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
.pg-caption { font-size: 12px; color: var(--text-secondary); margin-top: 8px; min-height: 16px; }

@media (max-width: 420px) {
  .practice-grid { gap: 3px; }
}
```

The mobile rule tightens the gutters rather than the slot height: 6px is the floor at which four slots stay legible.

- [ ] **Step 3: Wire it into the Dashboard**

In `src/views/Dashboard.jsx`, extend the rewards import from Task 5 to include `dailyPresence`:

```jsx
import { levelForPoints, levelProgress, habitStreak, dailyActivity, dailyPresence, todayKey } from '../lib/rewards'
```

Add the component import beside `DailyStack`:

```jsx
import PracticeGrid from '../components/PracticeGrid'
```

Add a new card directly below the "Last 7 days" card, still inside `dash-main`:

```jsx
          <div className="section-label">Last 5 weeks</div>
          <div className="card">
            <PracticeGrid weeks={dailyPresence(logs, notes, 5)} />
          </div>
```

- [ ] **Step 4: Run the full suite and lint**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 5: Verify in the running app**

Run: `pnpm dev`, open the Dashboard and scroll to "Last 5 weeks".
Expected: a 7-wide, 5-tall block of cells, weekday initials across the top, newest week at the bottom. Each cell is four constant-height slots. Days later this week are hollow outlines. Hovering a cell captions it with the date and which areas were touched.

Check a habit off and confirm today's cell lights its red slot. Narrow the window to phone width and confirm four slots per cell stay legible.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/PracticeGrid.jsx src/views/Dashboard.jsx src/App.css
git commit -m "feat(dashboard): 5-week practice presence grid"
```

---

## Verification

After Task 6, the whole branch:

```bash
pnpm test    # all suites green
pnpm lint    # oxlint clean
pnpm build   # vite build succeeds
```

Then confirm against the spec by hand on the running app:

- Four bands, colored blue/green/amber/red, stacking bottom-to-top in that order.
- Journaling three times in a day shows a journal band of 3, not 1.
- Completing a Finance item changes neither view.
- The grid is exactly 5x7 and the current week's future days are hollow.
- Nav and area edges now match band colors: journal blue, fitness amber, habits red, learnings orange.

## Deferred

Not in this plan, by design:

- **Fitness top priorities.** When built, only the `else` branch of `bandCounts` narrows to priority items. Nothing else moves.
- **Journal navigation, projects restructuring, notifications.** Separate specs.
- **jsdom for component tests.** Would let `DailyStack` and `PracticeGrid` be tested directly. A config change with repo-wide effects, so it is its own decision.
