# Supplements, Nudges refresh, and Focus (Pomodoro) — design

Three independent, small changes bundled in one spec because they were brainstormed
together. Each is separable at implementation time.

## 1. Supplements

Health gets a 4th bucket, `Supplements`, alongside its existing `Upcoming`, `Tracking`,
`Records`. Health also gains `habitBucket: 'Supplements'`, so items filed there check off
daily (like Fitness's `Top Priorities` and Diet's `Today's Meals`) instead of completing
once.

**Change:** `src/data/areas.js` — add `'Supplements'` to the `health` area's `buckets`
array and set `habitBucket: 'Supplements'`. No component changes: `AreaView.jsx` and
`ItemList.jsx` already render buckets and habit check-off generically off area config.

## 2. Nudges — minimal/quiet visual refresh

No behavior change — purely visual. Scope: `src/views/Nudges.jsx` markup +
`src/App.css` rules for `.nudge-row` / `.nudge-power`.

- `.nudge-row`: drop the shared `.item-row` card chrome (background, border,
  box-shadow) for this row type specifically; replace with a plain bottom divider
  (`border-bottom: 1px solid var(--surface-3)`), tighter padding.
- Toggle control: replace the bordered 30px `.nudge-power` button with a small filled
  dot (~8px) — orange (`var(--trim-o)`) when the nudge is on, `var(--text-muted)` when
  off. Stays a `<button>` for click target size/accessibility (hit area larger than the
  visible dot via padding), same `aria-label`/`aria-pressed` as today.
- `.nudge-meta` countdown text unchanged in content and logic — only spacing/color
  tightened to sit closer to the title given the calmer row.
- Quiet-hours block, add-row, and interval preset pills are unchanged — the ask was
  specifically about the row list, confirmed via the visual mockup (option C).

## 3. Focus (Pomodoro timer)

### New area

`src/data/areas.js` gains:

```js
{
  id: 'focus', name: 'Focus', icon: 'Timer', kind: 'focus',
  trim: 'v', route: '/focus',
  daily: { order: 5, series: 5 },
  keywords: ['focus', 'pomodoro', 'work', 'concentrate', 'timer'],
  buckets: [],
}
```

- `kind: 'focus'` is new (alongside `list`/`habits`/`journal`/`library`/`timers`/`money`)
  — a fully bespoke page, the same pattern `money` (Finance) and `timers` (Nudges)
  already use; it never routes through the generic `AreaView`.
- `daily: { order: 5, series: 5 }` makes Focus a 5th band in `DailyStack`/`PracticeGrid`,
  using `--series-5` (currently unused by any daily area — journal/diet/fitness/habits
  occupy 1–4). Per `CLAUDE.md`, `countsForDate` in `rewards.js` needs **no code change**
  for a 5th daily area: it already sums `complete`+`habit-check` logs generically by
  `areaId` for any non-journal/non-habits kind. Verify this holds during implementation
  (existing comment claims it; confirm with a test) rather than assuming.
- `trim: 'v'` (violet) — unused by any other *daily* area, so it won't sit next to a
  visually similar trim on the dashboard.
- `AreaIcon.jsx`: add `Timer` to the lucide import list and `ICONS` map (icons are an
  explicit allowlist for tree-shaking — every new area icon needs an entry there).

### Session logging — reuses existing primitives, no new log kind

When a work interval completes (not breaks), write one LOG:

```js
{ id: uid(), itemId: null, areaId: 'focus', kind: 'complete', date: todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null }
```

Same shape as the journal day-marker log (`itemId: null` is already a supported case —
see `store.js` line ~473). Because `kind: 'complete'` already feeds both
`rewards.js`'s band counting (dashboard chart) and `computePoints` (reward points), this
single write is the entire integration — no new LOG kind, no new primitive. Add a store
action, e.g. `logFocusSession()`, modeled on the existing `logSet()` action (same file,
same append-to-`logs` pattern), pushing the record above.

### Timer logic — `src/lib/focusTimer.js` (new, pure)

Modeled on `lib/timers.js`: no DOM, no real clock, no storage — `now` and state are
always arguments, so every rule is unit-testable without fake timers.

- Auto-cycling: work → short break → work → short break → ... → long break every 4th
  round, then back to round 1. Durations default `{ workMin: 25, shortBreakMin: 5,
  longBreakMin: 15, roundsBeforeLongBreak: 4 }`.
- Running state is anchored to wall-clock `endsAt` (epoch ms), not a decrementing
  counter — remaining time is always `endsAt - now`, computed on render. This is the
  same anchor trick `nudgeRunner.js` uses for nudges, and for the same reason: a tab
  backgrounded or the app closed and reopened must not drift or silently reset the
  countdown.
- Exported pure functions: something like `nextPhase(mode, round, settings)` →
  `{ mode, round, durationMs }`, and a `remainingMs(state, now)` helper. Exact shape
  finalized during implementation/TDD.

### Persistence — localStorage only, device-local (like `sidebarOrder.js`, nudge quiet hours)

- `stoa.focusSettings`: `{ workMin, shortBreakMin, longBreakMin, roundsBeforeLongBreak }`
  — editable via preset pills (same pattern as Nudges' `PRESETS` interval picker),
  editable only while idle/paused, not mid-countdown.
- `stoa.focusState`: `{ mode, endsAt, round, running }` — so a page refresh or app
  restart resumes the in-progress timer instead of losing it.

### UI — `src/views/Focus.jsx` (new)

Per the approved mockup (option B — "big digits + bar"):

- Mode label (`Work · round 2 of 4`), large monospace countdown, thin linear progress
  bar underneath filling toward phase end, 4-dot round indicator, Start/Pause/Reset
  controls, "N sessions today" (count of today's `areaId: 'focus'`/`kind: 'complete'`
  logs), duration preset pills below (work length, break length), same visual language
  as Nudges' interval pills.
- Notifications on phase transition (work done → break starting; break done → work
  starting) reuse `notify.js`'s existing permission flow verbatim (the same
  ask-on-first-toggle / respect denied/unsupported states Nudges already implements) —
  do not re-implement permission handling.

### Nav wiring — no extra work needed

`sidebarOrder.js`'s `orderableEntries()` is generated from `AREAS`, so adding the row
above automatically gives Focus a sidebar entry, a rankable bottom-nav slot, and an
`AreasGrid` card. One small addition: `AreasGrid.jsx`'s `countFor()` currently special-
cases only `kind === 'journal'`; add a `kind === 'focus'` branch that counts today's
focus logs instead of open items (Focus has no items, so the default branch would
always show "0 open").

## Out of scope

- No changes to Nudges' actual scheduling/notification logic, quiet hours, or preset
  intervals — visual only.
- No new LOG kind, no new ITEM shape, no 5th primitive — Focus sessions are LOGs using
  the existing `complete` kind.
- No cross-device sync considerations beyond what LOGs already get "for free" — the
  timer's *running* state (`stoa.focusState`) is explicitly device-local, matching how
  nudge anchors and quiet hours are already device-local for the same reason (a synced
  running countdown would desync the instant two devices are open at once).
