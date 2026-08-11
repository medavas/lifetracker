# Supplements, Nudges Refresh, and Focus Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supplements bucket to Health, restyle the Nudges list to a quieter/minimal look, and build a new Focus area with an auto-cycling, adjustable Pomodoro timer that feeds the existing dashboard/points system with zero new primitives.

**Architecture:** All three ride the existing 4-primitive model (`docs` — see `CLAUDE.md`). Supplements is a one-line area-config change. The Nudges refresh is CSS/markup only, no logic change. Focus is a new `AREAS` row with its own route/page (like Finance and Nudges already are), a pure phase-transition module (`lib/focusTimer.js`, modeled on `lib/timers.js`), a tick-orchestration + localStorage module (`lib/focusRunner.js`, modeled on `lib/nudgeRunner.js`), and one new store action that writes an ordinary `kind: 'complete'` LOG — which `rewards.js` already aggregates into the dashboard chart and points total for any daily-band area, with no changes to `rewards.js` itself.

**Tech Stack:** React 18, Zustand store, Vitest, react-router-dom, lucide-react icons. No new dependencies.

## Global Constraints

- Follow `CLAUDE.md`'s primitive rule: no new ITEM/LOG/NOTE shape beyond what's specified here. Focus sessions are LOGs using the existing `complete` kind.
- Every new pure-logic module takes `now` as an explicit argument (never reads the real clock internally) so it's testable without fake timers — the pattern `lib/timers.js` and `lib/nudgeRunner.js` already use.
- Device-local UI state (timer settings, in-progress countdown) goes in `localStorage`, never in the synced Zustand store — same reasoning as nudge quiet-hours and `sidebarOrder.js`: a synced running countdown would desync the instant two devices are open at once.
- Run `npm test` after every task; it must stay green throughout.

---

### Task 1: Supplements bucket in Health

**Files:**
- Modify: `src/data/areas.js` (the `health` area entry)
- Test: `src/data/__tests__/areas.test.js`

**Interfaces:**
- Produces: `health.buckets` includes `'Supplements'`; `health.habitBucket === 'Supplements'`. Nothing else consumes this beyond the existing generic `AreaView`/`ItemList` machinery, which already reads `habitBucket` off area config.

- [ ] **Step 1: Write the failing test**

Add to `src/data/__tests__/areas.test.js`, inside the existing `describe('habit-bucket areas', ...)` block (replacing the `'leaves every other area without a habit bucket'` test, which is about to become false for `health`):

```js
  it('names Supplements as the health habit bucket, listed last', () => {
    const health = AREAS.find((a) => a.id === 'health')
    expect(health.habitBucket).toBe('Supplements')
    expect(health.buckets).toEqual(['Upcoming', 'Tracking', 'Records', 'Supplements'])
  })

  it('leaves every non-habit-bucket area without one', () => {
    for (const a of AREAS) {
      if (['fitness', 'diet', 'health'].includes(a.id)) continue
      expect(a.habitBucket).toBeUndefined()
    }
  })
```

Delete the old `'leaves every other area without a habit bucket'` test it replaces.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- areas.test.js`
Expected: FAIL — `health.habitBucket` is `undefined`, `health.buckets` has no `'Supplements'`.

- [ ] **Step 3: Update the area config**

In `src/data/areas.js`, change the `health` entry:

```js
  {
    id: 'health', name: 'Health', icon: 'Stethoscope', kind: 'list',
    trim: 'r',
    habitBucket: 'Supplements',
    keywords: ['doctor', 'dentist', 'sleep', 'meds', 'appointment', 'health', 'supplement', 'vitamin'],
    buckets: ['Upcoming', 'Tracking', 'Records', 'Supplements'],
  },
```

(Added `habitBucket`, appended `'Supplements'` to `buckets`, and added `'supplement'`/`'vitamin'` to `keywords` so Quick Add's fuzzy match can route "vitamin d" into Health.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- areas.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js
git commit -m "feat(health): add a daily-checkoff Supplements bucket"
```

---

### Task 2: Nudges — minimal/quiet visual refresh

**Files:**
- Modify: `src/views/Nudges.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: nothing new — same `nudges`, `toggle`, `deleteItem` as today.
- Produces: no behavior change, so no new test surface. Verified visually.

- [ ] **Step 1: Swap the row markup**

In `src/views/Nudges.jsx`, remove `Power` from the lucide-react import (no longer used):

```js
import { Moon, Plus, Trash2 } from 'lucide-react'
```

Replace the row's toggle button and wrapper class. Find:

```jsx
            <div key={n.id} className="item-row nudge-row">
              <button
                className={`nudge-power ${n.enabled ? 'on' : ''}`}
                onClick={() => toggle(n)}
                aria-label={`${n.enabled ? 'Switch off' : 'Switch on'} ${n.title}`}
                aria-pressed={n.enabled}
              >
                <Power size={16} strokeWidth={2.25} />
              </button>
```

Replace with:

```jsx
            <div key={n.id} className="nudge-row">
              <button
                className={`nudge-dot ${n.enabled ? 'on' : ''}`}
                onClick={() => toggle(n)}
                aria-label={`${n.enabled ? 'Switch off' : 'Switch on'} ${n.title}`}
                aria-pressed={n.enabled}
              />
```

(The rest of the row — title, meta, delete button — is unchanged.)

- [ ] **Step 2: Replace the row/toggle CSS**

In `src/App.css`, replace the existing block:

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
```

with:

```css
.nudge-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 2px;
  border-bottom: 1px solid var(--surface-3);
  touch-action: manipulation;
}
.item-list .nudge-row:last-child { border-bottom: none; }

.nudge-dot {
  width: 30px; height: 30px; flex: none;
  display: grid; place-items: center;
  background: transparent; border: none;
}
.nudge-dot::after {
  content: '';
  width: 8px; height: 8px; border-radius: 999px;
  background: var(--text-muted);
}
.nudge-dot.on::after { background: var(--trim-o); }
.nudge-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
```

(Kept `.nudge-meta` as-is — only the row chrome and toggle changed.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (this task has no logic change, so this just confirms nothing else referenced the removed `.nudge-power` class or `Power` import — check with a repo-wide search first: `grep -rn "nudge-power\|nudge-row" src` should show only `Nudges.jsx`/`App.css`).

- [ ] **Step 4: Manually verify in the browser**

Use the project's `run` skill (or `npm run dev`) to open the app, navigate to Nudges, and confirm: existing nudges render with a plain divider and a small dot (filled orange when on, gray when off), toggling still works, delete still works, add-row and quiet-hours block are unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/views/Nudges.jsx src/App.css
git commit -m "style(nudges): minimal row treatment — dot toggle, plain divider"
```

---

### Task 3: Register the Focus area

**Files:**
- Modify: `src/data/areas.js`
- Modify: `src/components/AreaIcon.jsx`
- Test: `src/data/__tests__/areas.test.js`
- Test: `src/lib/__tests__/rewards.test.js`

**Interfaces:**
- Produces: `AREAS` includes a `focus` row with `kind: 'focus'`, `route: '/focus'`, `daily: { order: 5, series: 5 }`, `trim: 'v'`, `icon: 'Timer'`. `DAILY_BANDS` includes it in position 5. `AreaIcon` resolves `'Timer'`.

- [ ] **Step 1: Write the failing area-registry tests**

In `src/data/__tests__/areas.test.js`:

Add `focus: { trim: 'v', icon: 'Timer' }` to the `EXPECTED` map (after `nudges`).

Rename `'has exactly the 10 known areas'` → `'has exactly the 11 known areas'` (the assertion itself, `AREAS.map((a) => a.id).sort()` vs `Object.keys(EXPECTED).sort()`, needs no code change — it derives the count from `EXPECTED` automatically once `focus` is added there).

Replace the `'daily bands'` describe block's four order/membership tests:

```js
describe('daily bands', () => {
  it('marks exactly the five daily-practice areas', () => {
    expect(AREAS.filter((a) => a.daily).map((a) => a.id).sort()).toEqual(
      ['diet', 'fitness', 'focus', 'habits', 'journal'],
    )
  })

  it('assigns orders 1..5 with no duplicates', () => {
    const orders = AREAS.filter((a) => a.daily).map((a) => a.daily.order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5])
  })

  it('assigns a distinct series slot to each band', () => {
    const series = AREAS.filter((a) => a.daily).map((a) => a.daily.series)
    expect(new Set(series).size).toBe(series.length)
  })

  it('exposes DAILY_BANDS sorted bottom-to-top', () => {
    expect(DAILY_BANDS.map((a) => a.id)).toEqual(['journal', 'diet', 'fitness', 'habits', 'focus'])
  })

  it('gives every band a trim matching its own identity color family', () => {
    const trims = Object.fromEntries(DAILY_BANDS.map((a) => [a.id, a.trim]))
    expect(trims).toEqual({ journal: 'b', diet: 'g', fitness: 'y', habits: 'r', focus: 'v' })
  })
})
```

In the `'routing'` describe block, update `'leaves the daily bands untouched by the new area'` (this test's name/intent — "a new area" — was written for a past change; now it documents Focus joining the bands) to:

```js
  it('routes focus to its own page with no buckets', () => {
    const focus = AREAS.find((a) => a.id === 'focus')
    expect(focus.kind).toBe('focus')
    expect(focus.route).toBe('/focus')
    expect(focus.buckets).toEqual([])
    expect(focus.daily).toEqual({ order: 5, series: 5 })
  })
```

and add `'focus'` to the exclusion list in `'routes every other area through the generic area view'`:

```js
      if (['journal', 'habits', 'nudges', 'finance', 'projects', 'fitness', 'focus'].includes(a.id)) continue
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- areas.test.js`
Expected: FAIL — no `focus` area exists yet.

- [ ] **Step 3: Add the Focus area to the registry**

In `src/data/areas.js`, append after the `nudges` entry (still inside the `AREAS` array):

```js
  {
    id: 'focus', name: 'Focus', icon: 'Timer', kind: 'focus',
    trim: 'v', route: '/focus',
    daily: { order: 5, series: 5 },
    keywords: ['focus', 'pomodoro', 'work', 'concentrate', 'timer'],
    buckets: [],
  },
```

Also update the file's top JSDoc comment listing valid `kind` values to include `'focus'`:

```
 *  - 'focus'   - a single Pomodoro-style countdown timer, its own page
```

- [ ] **Step 4: Register the Timer icon**

In `src/components/AreaIcon.jsx`, add `Timer` to both the import and the `ICONS` map:

```js
import {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain, BellRing,
  House, LayoutGrid, Settings, Timer,
} from 'lucide-react'

export const ICONS = {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain, BellRing,
  House, LayoutGrid, Settings, Timer,
}
```

- [ ] **Step 5: Run areas tests to verify they pass**

Run: `npm test -- areas.test.js`
Expected: PASS

- [ ] **Step 6: Fix the now-broken rewards tests and add a Focus-specific one**

`src/lib/__tests__/rewards.test.js` has three assertions hardcoded to the old four-band shape. In `describe('bandCounts', ...)`:

```js
  it('returns a zero for every band when nothing happened', () => {
    expect(bandCounts([], [], D)).toEqual({ journal: 0, diet: 0, fitness: 0, habits: 0, focus: 0 })
  })
```

Add a new test in the same block, proving the claim from `CLAUDE.md` that a 5th daily area needs no code change — a `focus`-area `complete` log is picked up by the same generic branch fitness's habit-check already uses:

```js
  it('counts completes into the focus band with no dedicated code path (5th-band claim)', () => {
    const logs = [log({ kind: 'complete', areaId: 'focus', date: D })]
    expect(bandCounts(logs, [], D).focus).toBe(1)
  })
```

In `describe('dailyActivity', ...)`, update the two hardcoded band shapes:

```js
    expect(out[0]).toEqual({ date: '2026-07-29', bands: { journal: 0, diet: 0, fitness: 0, habits: 0, focus: 0 }, total: 0 })
```

```js
    expect(today.bands).toEqual({ journal: 1, diet: 1, fitness: 0, habits: 2, focus: 0 })
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS. (`PracticeGrid.test.js` and `chart.test.js` are unaffected — cell/geometry counts don't depend on the number of bands.)

- [ ] **Step 8: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js src/components/AreaIcon.jsx src/lib/__tests__/rewards.test.js
git commit -m "feat(focus): register the Focus area as a 5th daily band"
```

---

### Task 4: Pure phase-transition logic — `lib/focusTimer.js`

**Files:**
- Create: `src/lib/focusTimer.js`
- Test: `src/lib/__tests__/focusTimer.test.js`

**Interfaces:**
- Produces (consumed by Task 5's runner and Task 7's view):
  - `DEFAULT_SETTINGS = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, roundsBeforeLongBreak: 4 }`
  - `MODES = { WORK: 'work', SHORT_BREAK: 'short-break', LONG_BREAK: 'long-break' }`
  - `IDLE_STATE` — `{ mode: 'work', round: 1, status: 'idle', remainingMs: null, runningSince: null }`
  - `phaseDurationMs(mode, settings) -> number`
  - `nextPhase(mode, round, settings) -> { mode, round }`
  - `remainingMs(state, now) -> number` (never negative)
  - `isDue(state, now) -> boolean`
  - `start(state, settings, now) -> state` (begins or resumes counting down)
  - `pause(state, now) -> state` (freezes the countdown)
  - `reset(settings) -> state` (fresh work phase, round 1, idle)
  - `advance(state, settings, now) -> state` (moves a due state to its next phase, still running)

This is a pure module: no DOM, no real clock, no storage. `now` is always a parameter.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/focusTimer.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS, MODES, IDLE_STATE,
  phaseDurationMs, nextPhase, remainingMs, isDue, start, pause, reset, advance,
} from '../focusTimer.js'

const MIN = 60_000
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

describe('phaseDurationMs', () => {
  it('maps each mode to its configured minutes', () => {
    expect(phaseDurationMs(MODES.WORK, DEFAULT_SETTINGS)).toBe(25 * MIN)
    expect(phaseDurationMs(MODES.SHORT_BREAK, DEFAULT_SETTINGS)).toBe(5 * MIN)
    expect(phaseDurationMs(MODES.LONG_BREAK, DEFAULT_SETTINGS)).toBe(15 * MIN)
  })
})

describe('nextPhase', () => {
  it('sends a work round before the last into a short break, same round number', () => {
    expect(nextPhase(MODES.WORK, 1, DEFAULT_SETTINGS)).toEqual({ mode: MODES.SHORT_BREAK, round: 1 })
    expect(nextPhase(MODES.WORK, 3, DEFAULT_SETTINGS)).toEqual({ mode: MODES.SHORT_BREAK, round: 3 })
  })

  it('sends the last work round of the cycle into a long break', () => {
    expect(nextPhase(MODES.WORK, 4, DEFAULT_SETTINGS)).toEqual({ mode: MODES.LONG_BREAK, round: 4 })
  })

  it('sends a short break back to work, incrementing the round', () => {
    expect(nextPhase(MODES.SHORT_BREAK, 1, DEFAULT_SETTINGS)).toEqual({ mode: MODES.WORK, round: 2 })
  })

  it('sends a long break back to work, resetting the round to 1', () => {
    expect(nextPhase(MODES.LONG_BREAK, 4, DEFAULT_SETTINGS)).toEqual({ mode: MODES.WORK, round: 1 })
  })

  it('honors a non-default roundsBeforeLongBreak', () => {
    const settings = { ...DEFAULT_SETTINGS, roundsBeforeLongBreak: 2 }
    expect(nextPhase(MODES.WORK, 2, settings)).toEqual({ mode: MODES.LONG_BREAK, round: 2 })
  })
})

describe('start / pause / remainingMs / isDue', () => {
  it('start seeds remainingMs from settings when the state is idle', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(running).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 25 * MIN, runningSince: now })
  })

  it('remainingMs counts down from runningSince while running', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(remainingMs(running, now + 10 * MIN)).toBe(15 * MIN)
  })

  it('remainingMs never goes negative', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(remainingMs(running, now + 999 * MIN)).toBe(0)
  })

  it('pause freezes the countdown into remainingMs and clears runningSince', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const paused = pause(running, now + 10 * MIN)
    expect(paused).toEqual({ mode: MODES.WORK, round: 1, status: 'paused', remainingMs: 15 * MIN, runningSince: null })
    // frozen regardless of how much later `now` advances
    expect(remainingMs(paused, now + 999 * MIN)).toBe(15 * MIN)
  })

  it('pausing a state that is not running is a no-op', () => {
    expect(pause(IDLE_STATE, at(12))).toEqual(IDLE_STATE)
  })

  it('start resumes a paused state from its frozen remainingMs, not a fresh duration', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const paused = pause(running, now + 10 * MIN)
    const resumed = start(paused, DEFAULT_SETTINGS, now + 60 * MIN)
    expect(resumed).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 15 * MIN, runningSince: now + 60 * MIN })
  })

  it('isDue is false until remaining time hits zero, then true', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(isDue(running, now + 24 * MIN + 59_000)).toBe(false)
    expect(isDue(running, now + 25 * MIN)).toBe(true)
  })

  it('an idle or paused state is never due', () => {
    expect(isDue(IDLE_STATE, at(12))).toBe(false)
    const paused = pause(start(IDLE_STATE, DEFAULT_SETTINGS, at(12)), at(12, 10))
    expect(isDue(paused, at(23))).toBe(false)
  })
})

describe('reset', () => {
  it('returns an idle work phase at round 1, seeded from settings', () => {
    expect(reset(DEFAULT_SETTINGS)).toEqual({
      mode: MODES.WORK, round: 1, status: 'idle', remainingMs: 25 * MIN, runningSince: null,
    })
  })

  it('reflects a custom workMin', () => {
    expect(reset({ ...DEFAULT_SETTINGS, workMin: 50 }).remainingMs).toBe(50 * MIN)
  })
})

describe('advance', () => {
  it('moves a due running work phase into its short break, still running', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const due = now + 25 * MIN
    const next = advance(running, DEFAULT_SETTINGS, due)
    expect(next).toEqual({
      mode: MODES.SHORT_BREAK, round: 1, status: 'running', remainingMs: 5 * MIN, runningSince: due,
    })
  })

  it('moves the 4th work round into a long break', () => {
    const now = at(12)
    const running = start({ ...IDLE_STATE, round: 4 }, DEFAULT_SETTINGS, now)
    const next = advance(running, DEFAULT_SETTINGS, now + 25 * MIN)
    expect(next.mode).toBe(MODES.LONG_BREAK)
    expect(next.remainingMs).toBe(15 * MIN)
  })

  it('moves a long break back into round 1 of work', () => {
    const now = at(12)
    const running = start({ ...IDLE_STATE, mode: MODES.LONG_BREAK, round: 4 }, DEFAULT_SETTINGS, now)
    const next = advance(running, DEFAULT_SETTINGS, now + 15 * MIN)
    expect(next).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 25 * MIN, runningSince: now + 15 * MIN })
  })

  it('never cascades past one phase per call, even hours overdue', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const wayLate = now + 4 * 60 * MIN
    const next = advance(running, DEFAULT_SETTINGS, wayLate)
    expect(next.mode).toBe(MODES.SHORT_BREAK)
    expect(next.remainingMs).toBe(5 * MIN) // fresh short break, not negative/cascaded
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- focusTimer.test.js`
Expected: FAIL — `../focusTimer.js` does not exist yet.

- [ ] **Step 3: Implement `src/lib/focusTimer.js`**

```js
/**
 * Focus (Pomodoro) phase logic -- pure. No DOM, no real clock, no storage:
 * `now` is always an argument, which is what makes every rule below testable
 * without fake timers. Modeled on lib/timers.js.
 *
 * State shape: { mode, round, status, remainingMs, runningSince }
 *   mode          - 'work' | 'short-break' | 'long-break'
 *   round         - which work round of the current cycle (1..roundsBeforeLongBreak)
 *   status        - 'idle' | 'running' | 'paused'
 *   remainingMs   - ms left in the current phase, valid when idle/paused;
 *                   while running it's the snapshot taken at runningSince
 *   runningSince  - epoch ms the current running stretch started, or null
 */

const MS_PER_MIN = 60_000

export const DEFAULT_SETTINGS = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, roundsBeforeLongBreak: 4 }

export const MODES = { WORK: 'work', SHORT_BREAK: 'short-break', LONG_BREAK: 'long-break' }

export const IDLE_STATE = { mode: MODES.WORK, round: 1, status: 'idle', remainingMs: null, runningSince: null }

/** How long a phase lasts, in ms, per the current settings. */
export function phaseDurationMs(mode, settings) {
  const min =
    mode === MODES.WORK ? settings.workMin
    : mode === MODES.SHORT_BREAK ? settings.shortBreakMin
    : settings.longBreakMin
  return min * MS_PER_MIN
}

/**
 * What comes after the given mode/round finishes. A long break always
 * resets the round counter to 1; a short break advances it by one; work
 * goes to a long break on the last round of the cycle, a short break
 * otherwise.
 */
export function nextPhase(mode, round, settings) {
  if (mode === MODES.WORK) {
    return round >= settings.roundsBeforeLongBreak
      ? { mode: MODES.LONG_BREAK, round }
      : { mode: MODES.SHORT_BREAK, round }
  }
  return mode === MODES.LONG_BREAK
    ? { mode: MODES.WORK, round: 1 }
    : { mode: MODES.WORK, round: round + 1 }
}

/** ms left in the current phase right now. Never negative. Idle/paused states report their frozen remainingMs. */
export function remainingMs(state, now) {
  if (state.status !== 'running') return Math.max(0, state.remainingMs ?? 0)
  return Math.max(0, state.remainingMs - (now - state.runningSince))
}

export function isDue(state, now) {
  return state.status === 'running' && remainingMs(state, now) <= 0
}

/**
 * Begin (fresh) or resume (from a pause) counting down. Idle states with no
 * remainingMs get one seeded from settings; a paused state's frozen
 * remainingMs is preserved rather than restarting the phase.
 */
export function start(state, settings, now) {
  const remaining = state.remainingMs ?? phaseDurationMs(state.mode, settings)
  return { ...state, status: 'running', remainingMs: remaining, runningSince: now }
}

/** Freezes the countdown, converting elapsed running time into a stored remainingMs. No-op if not running. */
export function pause(state, now) {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused', remainingMs: remainingMs(state, now), runningSince: null }
}

/** Back to a fresh work phase, round 1, idle. */
export function reset(settings) {
  return { mode: MODES.WORK, round: 1, status: 'idle', remainingMs: phaseDurationMs(MODES.WORK, settings), runningSince: null }
}

/**
 * Moves a due running state to its next phase, still running, anchored to
 * `now`. Always exactly one phase per call -- a state that's hours overdue
 * (app closed mid-phase) jumps straight to the next phase with a fresh
 * countdown rather than cascading through every phase that would have
 * elapsed, the same "fires once, resets anchor to now" rule lib/timers.js
 * applies to overdue nudges.
 */
export function advance(state, settings, now) {
  const { mode, round } = nextPhase(state.mode, state.round, settings)
  return { mode, round, status: 'running', remainingMs: phaseDurationMs(mode, settings), runningSince: now }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- focusTimer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/focusTimer.js src/lib/__tests__/focusTimer.test.js
git commit -m "feat(focus): pure Pomodoro phase-transition logic"
```

---

### Task 5: Tick orchestration + storage — `lib/focusRunner.js`

**Files:**
- Create: `src/lib/focusRunner.js`
- Test: `src/lib/__tests__/focusRunner.test.js`

**Interfaces:**
- Consumes: everything from Task 4 (`isDue`, `advance`, `IDLE_STATE`, `DEFAULT_SETTINGS`).
- Produces (consumed by Task 7's view):
  - `TICK_MS = 1000`
  - `createFocusRunner({ getState, setState, getSettings, now, fire, onWorkComplete }) -> { tick() }`
  - `readSettings() -> settings`, `writeSettings(settings)`
  - `readState() -> state`, `writeState(state)`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/focusRunner.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createFocusRunner, TICK_MS,
  readSettings, writeSettings, readState, writeState,
} from '../focusRunner.js'
import { DEFAULT_SETTINGS, MODES, IDLE_STATE, start } from '../focusTimer.js'

const MIN = 60_000
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

/** Wires createFocusRunner to plain in-memory refs instead of localStorage. */
const harness = ({ state, settings = DEFAULT_SETTINGS, now }) => {
  let current = state
  const fired = []
  const completions = []
  const runner = createFocusRunner({
    getState: () => current,
    setState: (next) => { current = next },
    getSettings: () => settings,
    now: () => now,
    fire: (body) => fired.push(body),
    onWorkComplete: () => completions.push(true),
  })
  return { runner, fired, completions, state: () => current }
}

describe('createFocusRunner', () => {
  it('ticks every second', () => {
    expect(TICK_MS).toBe(1000)
  })

  it('does nothing when the state is not due', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 10 * MIN })
    h.runner.tick()
    expect(h.state()).toBe(running)
    expect(h.fired).toEqual([])
    expect(h.completions).toEqual([])
  })

  it('does nothing when idle or paused, however much time has passed', () => {
    const h = harness({ state: IDLE_STATE, now: at(12) + 999 * MIN })
    h.runner.tick()
    expect(h.state()).toBe(IDLE_STATE)
  })

  it('advances a due work phase to its break and fires a notification', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 25 * MIN })
    h.runner.tick()
    expect(h.state().mode).toBe(MODES.SHORT_BREAK)
    expect(h.fired).toHaveLength(1)
  })

  it('calls onWorkComplete only when the phase that just finished was work', () => {
    const now = at(12)
    const runningBreak = start({ ...IDLE_STATE, mode: MODES.SHORT_BREAK }, DEFAULT_SETTINGS, now)
    const h = harness({ state: runningBreak, now: now + 5 * MIN })
    h.runner.tick()
    expect(h.state().mode).toBe(MODES.WORK)
    expect(h.completions).toEqual([])
  })

  it('calls onWorkComplete exactly once when a work phase finishes', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 25 * MIN })
    h.runner.tick()
    expect(h.completions).toEqual([true])
    h.runner.tick() // not due again immediately
    expect(h.completions).toEqual([true])
  })
})

// ── Device-local storage ────────────────────────────────────────
const SETTINGS_KEY = 'stoa.focusSettings'
const STATE_KEY = 'stoa.focusState'

const stubLocalStorage = () => {
  const map = new Map()
  const storage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('device-local storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('readSettings falls back to defaults with nothing stored', () => {
    stubLocalStorage()
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('writeSettings round-trips through readSettings', () => {
    stubLocalStorage()
    writeSettings({ ...DEFAULT_SETTINGS, workMin: 50 })
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, workMin: 50 })
  })

  it('readSettings merges a partial stored config over the defaults', () => {
    const storage = stubLocalStorage()
    storage.setItem(SETTINGS_KEY, JSON.stringify({ workMin: 50 }))
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, workMin: 50 })
  })

  it('readSettings returns defaults on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(SETTINGS_KEY, '{not json')
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('readState falls back to IDLE_STATE with nothing stored', () => {
    stubLocalStorage()
    expect(readState()).toEqual(IDLE_STATE)
  })

  it('writeState round-trips through readState', () => {
    stubLocalStorage()
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, at(12))
    writeState(running)
    expect(readState()).toEqual(running)
  })

  it('readState returns IDLE_STATE on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(STATE_KEY, '{not json')
    expect(readState()).toEqual(IDLE_STATE)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- focusRunner.test.js`
Expected: FAIL — `../focusRunner.js` does not exist yet.

- [ ] **Step 3: Implement `src/lib/focusRunner.js`**

```js
/**
 * Focus timer orchestration -- ticks the pure focusTimer.js logic and owns
 * the two pieces of device-local state (settings, in-progress countdown).
 * Modeled on lib/nudgeRunner.js: injected getState/setState/getSettings/now/
 * fire keep tick() testable without a DOM, a real clock, or localStorage.
 */
import { isDue, advance, MODES, DEFAULT_SETTINGS, IDLE_STATE } from './focusTimer'

export const TICK_MS = 1000

function messageFor(mode) {
  if (mode === MODES.WORK) return "Break's over — back to it"
  if (mode === MODES.LONG_BREAK) return 'Nice work — take a longer break'
  return 'Work session done — take a break'
}

/**
 * `fire` and `onWorkComplete` are only called when a phase genuinely
 * completes on this tick -- never on every call, never more than once per
 * completed phase (see focusTimer.js's advance() for why a state overdue by
 * hours still only advances one phase per tick).
 */
export function createFocusRunner({ getState, setState, getSettings, now, fire, onWorkComplete }) {
  function tick() {
    const state = getState()
    const n = now()
    if (!isDue(state, n)) return state
    const completedMode = state.mode
    const next = advance(state, getSettings(), n)
    setState(next)
    if (completedMode === MODES.WORK) onWorkComplete?.()
    fire?.(messageFor(next.mode))
    return next
  }
  return { tick }
}

// ── Device-local storage ────────────────────────────────────────
const SETTINGS_KEY = 'stoa.focusSettings'
const STATE_KEY = 'stoa.focusState'

function readJson(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}

export const readSettings = () => readJson(SETTINGS_KEY, DEFAULT_SETTINGS)
export const writeSettings = (settings) => writeJson(SETTINGS_KEY, settings)

export const readState = () => readJson(STATE_KEY, IDLE_STATE)
export const writeState = (state) => writeJson(STATE_KEY, state)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- focusRunner.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/focusRunner.js src/lib/__tests__/focusRunner.test.js
git commit -m "feat(focus): tick orchestration and device-local persistence"
```

---

### Task 6: Store action — `logFocusSession`

**Files:**
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/store.test.js`

**Interfaces:**
- Produces: `logFocusSession(date?)` — appends `{ itemId: null, areaId: 'focus', kind: 'complete', date: date ?? todayKey(), ... }` to `logs` and recomputes `points`. Consumed by Task 7's view via `useStore((s) => s.logFocusSession)`.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/lib/__tests__/store.test.js` (place it near the other log-writing action tests, e.g. after whichever block covers `logSet`):

```js
describe('logFocusSession', () => {
  beforeEach(reset)

  it('appends a complete log with a null itemId, areaId focus', () => {
    useStore.getState().logFocusSession('2026-08-10')
    const logs = useStore.getState().logs
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ itemId: null, areaId: 'focus', kind: 'complete', date: '2026-08-10' })
  })

  it('defaults date to today when omitted', () => {
    useStore.getState().logFocusSession()
    expect(useStore.getState().logs[0].date).toBe(todayKey())
  })

  it('awards task points, same as any other completion', () => {
    useStore.getState().logFocusSession('2026-08-10')
    expect(useStore.getState().points).toBe(10)
  })

  it('each call appends its own log — no dedup, no cap', () => {
    useStore.getState().logFocusSession('2026-08-10')
    useStore.getState().logFocusSession('2026-08-10')
    expect(useStore.getState().logs).toHaveLength(2)
    expect(useStore.getState().points).toBe(20)
  })
})
```

Check the top of `store.test.js` for how `todayKey` is imported (it's already used by other date-defaulting tests in that file) and reuse the same import rather than adding a second one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- store.test.js`
Expected: FAIL — `logFocusSession` is not a function.

- [ ] **Step 3: Add the action**

In `src/lib/store.js`, insert after `deleteNote` (right before `mergeRemote`):

```js
      // ── Focus (Pomodoro) ─────────────────────────────────────
      /**
       * One completed work interval = one ordinary 'complete' log, itemId
       * null (same shape the journal day-marker already uses). This is the
       * entire dashboard/points integration -- rewards.js already sums any
       * complete/habit-check log by areaId for a daily-band area, so no
       * dedicated Focus code exists there.
       */
      logFocusSession: (date) => {
        const logs = [
          ...get().logs,
          { id: uid(), itemId: null, areaId: 'focus', kind: 'complete', date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null },
        ]
        set({ logs, points: computePoints(logs) })
      },

```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- store.test.js`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.js src/lib/__tests__/store.test.js
git commit -m "feat(focus): logFocusSession store action"
```

---

### Task 7: Focus page — UI, routing, CSS

**Files:**
- Create: `src/views/Focus.jsx`
- Modify: `src/App.jsx` (route)
- Modify: `src/views/AreasGrid.jsx` (card count)
- Modify: `src/App.css` (styles)

**Interfaces:**
- Consumes: `focusTimer.js` and `focusRunner.js` (Tasks 4–5), `logFocusSession` (Task 6), `notify.js` (existing, unchanged), the `focus` area from `areas.js` (Task 3).
- Produces: the `/focus` page. No new exports consumed elsewhere.

This task is UI wiring, not pure logic — like `Nudges.jsx` and `Fitness.jsx`, it has no dedicated unit test in this codebase (no React Testing Library is set up here); it's verified by running the app. Each step below is still a real, complete code change — write it in full, then verify by running the dev server at the end.

- [ ] **Step 1: Write `src/views/Focus.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/rewards'
import { notifyPermission, requestNotifyPermission, fireNotification } from '../lib/notify'
import {
  MODES, phaseDurationMs, remainingMs as computeRemainingMs,
  start as startPhase, pause as pausePhase, reset as resetPhase,
} from '../lib/focusTimer'
import { createFocusRunner, TICK_MS, readSettings, writeSettings, readState, writeState } from '../lib/focusRunner'
import AreaIcon from '../components/AreaIcon'

const WORK_PRESETS = [15, 25, 50]
const BREAK_PRESETS = [5, 10, 15]
const MODE_LABEL = { [MODES.WORK]: 'Work', [MODES.SHORT_BREAK]: 'Short break', [MODES.LONG_BREAK]: 'Long break' }

const fmt = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Focus() {
  const logs = useStore((s) => s.logs)
  const logFocusSession = useStore((s) => s.logFocusSession)

  const [settings, setSettings] = useState(readSettings)
  const [state, setState] = useState(readState)
  const [clock, setClock] = useState(() => Date.now())

  const settingsRef = useRef(settings)
  const stateRef = useRef(state)
  settingsRef.current = settings
  stateRef.current = state

  const applyState = (next) => {
    stateRef.current = next
    setState(next)
    writeState(next)
  }

  // Ticks once a second: re-renders the countdown and, via the runner,
  // advances/logs/notifies exactly when a phase completes. Runs an
  // immediate tick on mount too, so reopening the page after the phase
  // already elapsed (tab closed, app backgrounded) catches up right away
  // instead of waiting for the next second.
  useEffect(() => {
    const runner = createFocusRunner({
      getState: () => stateRef.current,
      setState: applyState,
      getSettings: () => settingsRef.current,
      now: () => Date.now(),
      onWorkComplete: () => logFocusSession(todayKey()),
      fire: (body) => fireNotification(body, 'focus'),
    })
    runner.tick()
    const id = setInterval(() => {
      runner.tick()
      setClock(Date.now())
    }, TICK_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onStart = async () => {
    if (notifyPermission() === 'default') {
      // Best-effort -- unlike Nudges, the timer itself is useful with or
      // without notifications, so a dismissed/denied prompt doesn't block
      // starting it.
      await requestNotifyPermission()
    }
    applyState(startPhase(stateRef.current, settingsRef.current, Date.now()))
  }

  const onPause = () => applyState(pausePhase(stateRef.current, Date.now()))

  const onReset = () => applyState(resetPhase(settingsRef.current))

  const saveSettings = (next) => {
    setSettings(next)
    settingsRef.current = next
    writeSettings(next)
    // Only the fully-idle countdown reflects a preset change immediately --
    // a paused or running phase keeps its current time, the new duration
    // applies starting next phase.
    if (stateRef.current.status === 'idle') applyState(resetPhase(next))
  }

  const setWorkMin = (workMin) => saveSettings({ ...settings, workMin })
  const setBreakMin = (shortBreakMin) => saveSettings({ ...settings, shortBreakMin })

  const remaining = computeRemainingMs(state, clock)
  const duration = phaseDurationMs(state.mode, settings)
  const fillPct = duration > 0 ? Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100)) : 0
  const completedRounds = state.mode === MODES.WORK ? state.round - 1 : state.round
  const sessionsToday = logs.filter(
    (l) => !l.deletedAt && l.areaId === 'focus' && l.kind === 'complete' && l.date === todayKey(),
  ).length
  const pillsDisabled = state.status === 'running'

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-v)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="Timer" /></div>
        <h1>Focus</h1>
      </div>

      <div className="focus-body">
        <div className="focus-mode">{MODE_LABEL[state.mode]} · round {state.round} of {settings.roundsBeforeLongBreak}</div>
        <div className="focus-time">{fmt(remaining)}</div>
        <div className="focus-bar-track"><div className="focus-bar-fill" style={{ width: `${fillPct}%` }} /></div>
        <div className="focus-dots">
          {Array.from({ length: settings.roundsBeforeLongBreak }, (_, i) => (
            <div key={i} className={`focus-dot ${i < completedRounds ? 'done' : ''}`} />
          ))}
        </div>
        <div className="focus-controls">
          {state.status === 'running' ? (
            <button className="focus-btn primary" onClick={onPause}>Pause</button>
          ) : (
            <button className="focus-btn primary" onClick={onStart}>{state.status === 'paused' ? 'Resume' : 'Start'}</button>
          )}
          <button className="focus-btn" onClick={onReset}>Reset</button>
        </div>
        <div className="focus-today">{sessionsToday} session{sessionsToday === 1 ? '' : 's'} today</div>
      </div>

      <div className="section">
        <div className="label">Work length</div>
        <div className="bucket-tabs">
          {WORK_PRESETS.map((m) => (
            <button
              key={m}
              className={`bucket-tab ${settings.workMin === m ? 'on' : ''}`}
              disabled={pillsDisabled}
              onClick={() => setWorkMin(m)}
            >
              {m}m
            </button>
          ))}
        </div>
        <div className="label" style={{ marginTop: 10 }}>Break length</div>
        <div className="bucket-tabs">
          {BREAK_PRESETS.map((m) => (
            <button
              key={m}
              className={`bucket-tab ${settings.shortBreakMin === m ? 'on' : ''}`}
              disabled={pillsDisabled}
              onClick={() => setBreakMin(m)}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/App.jsx`, add the import alongside the other view imports:

```js
import Focus from './views/Focus'
```

and add the route next to Nudges:

```jsx
          <Route path="/nudges" element={<Nudges />} />
          <Route path="/focus" element={<Focus />} />
```

- [ ] **Step 3: Give Focus a real card count on the Areas grid**

In `src/views/AreasGrid.jsx`, `countFor` currently only special-cases `kind === 'journal'`; add a `focus` branch so the card shows sessions-today instead of "0 open" (Focus has no items):

```jsx
  const countFor = (a) =>
    a.kind === 'journal'
      ? notes.filter((n) => n.areaId === 'journal' && !n.itemId).length
      : a.kind === 'focus'
        ? logs.filter((l) => !l.deletedAt && l.areaId === 'focus' && l.kind === 'complete' && l.date === todayKey()).length
        : items.filter((i) => i.areaId === a.id && i.status === 'open' && !i.parentId).length
```

and the label:

```jsx
                  {countFor(a)} {a.kind === 'journal' ? 'entries' : a.kind === 'focus' ? 'today' : 'open'}
```

This needs `logs` and `todayKey`; add them:

```js
import { todayKey } from '../lib/rewards'
```

```jsx
  const logs = useStore((s) => s.logs)
```

(alongside the existing `items`/`notes` selectors).

- [ ] **Step 4: Add Focus page CSS**

In `src/App.css`, append:

```css
/* ── Focus (Pomodoro) ────────────────────────────────────── */
.focus-body {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 24px 16px 28px;
}
.focus-mode {
  color: var(--text-secondary); font-size: 12px;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.focus-time {
  font-size: 52px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.focus-bar-track {
  width: 100%; max-width: 260px; height: 4px; border-radius: 2px;
  background: var(--surface-3); overflow: hidden;
}
.focus-bar-fill { height: 100%; background: var(--trim-v); }
.focus-dots { display: flex; gap: 6px; }
.focus-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--surface-3); }
.focus-dot.done { background: var(--trim-v); }
.focus-controls { display: flex; gap: 10px; }
.focus-btn {
  padding: 8px 22px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text-primary); font-size: 13px; font-weight: 600;
}
.focus-btn.primary { background: var(--text-primary); color: var(--bg); border-color: var(--text-primary); }
.focus-today { color: var(--text-muted); font-size: 12px; }
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Manually verify in the browser**

Use the project's `run` skill (or `npm run dev`). On the Focus page:
- Confirm the countdown shows `25:00`, mode reads "Work · round 1 of 4".
- Click Start — the button becomes Pause, the countdown ticks down, the bar fills.
- Click Pause, confirm the countdown freezes; click Resume (same button, relabeled), confirm it continues from where it froze rather than restarting.
- Click Reset, confirm it returns to `25:00`, idle.
- Change the Work/Break preset pills while idle, confirm the countdown updates immediately; start the timer and confirm the pills become disabled.
- To verify a full phase transition without waiting 25 minutes, temporarily run this in the browser devtools console, then reload the page: `localStorage.setItem('stoa.focusSettings', JSON.stringify({ workMin: 0.05, shortBreakMin: 0.05, longBreakMin: 0.05, roundsBeforeLongBreak: 4 }))` (3-second phases). Start the timer, confirm it auto-advances to "Short break" without any click, and that a browser notification appears (grant permission when prompted). Confirm the Dashboard's "Last 7 days" chart gains a violet Focus segment and the point total increases by 10 after the work phase completes. Clear that localStorage override afterward: `localStorage.removeItem('stoa.focusSettings')`.
- Confirm the Areas grid's Focus card shows "N today" instead of "0 open".

- [ ] **Step 7: Commit**

```bash
git add src/views/Focus.jsx src/App.jsx src/views/AreasGrid.jsx src/App.css
git commit -m "feat(focus): Pomodoro timer page, routing, and dashboard wiring"
```

---

## Post-plan check

After all seven tasks: run `npm test` once more (full green suite), then `npm run lint` to catch anything the per-task runs didn't (unused `Power` import in Task 2, unused variables, etc.) — fix any findings before considering this done.
