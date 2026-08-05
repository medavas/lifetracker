# Fitness top priorities — a customizable daily checklist that actually feeds the graph

Date: 2026-08-05

## Summary

Fitness gets a "Top Priorities" bucket. Items filed there behave like a
Habit — check them off daily, build a streak, earn the standard habit
points — instead of the one-shot task checkbox every other Fitness item
uses. Opening Fitness lands you on that bucket by default.

This also fixes a real bug: the daily stacked chart and 5-week practice grid
currently cannot show repeated Fitness activity at all. A task completes
once and never contributes to the band again. Top priorities are the fix,
not a separate feature bolted on top of it.

## The bug

`countsForDate` in `src/lib/rewards.js` derives the fitness band from
`complete|fitness` logs only:

```js
} else {
  out[area.id] = day ? day.get(`complete|${area.id}`) || 0 : 0
}
```

A `complete` log is written once, the moment an item's `status` flips to
`'done'`. There is no daily re-arm for a task the way there is for a habit
check-in (`toggleHabitToday`, which is a per-day toggle keyed by date). So a
Fitness item can appear on the chart on exactly one day of its existence,
ever — "workout" finished on Tuesday shows once, then never again, no
matter how many times you actually work out.

## Why bucket, not a new field

The obvious alternative is a boolean on ITEM (`isPriority: true`) or a new
`type: 'habit'` value read outside the Habits area. Bucket is better for one
reason: **the bucket picker already exists.** Every item already has a
`bucket` field and a picker to change it, in `ItemSheet`. Making the bucket
itself the source of truth means:

- No new ITEM field, no migration, no touching `addItem`'s type-inference.
- Promoting or demoting an item — "this PR goal is now something I want to
  check off daily" — is just moving it to a different bucket with UI that
  already exists.
- The mechanism is generic from day one: any list-kind area can opt in later
  by naming one of its own buckets as the habit bucket. Only Fitness does
  today.

`item.type` stays exactly as it is — set by `addItem`'s existing default,
read nowhere new. This feature does not touch it.

## Architecture

Still 4 primitives. No new area kind, no new log kind, no new ITEM field.

### AREA — one config change

In `src/data/areas.js`, the `fitness` row:

```js
{
  id: 'fitness', name: 'Fitness', icon: 'Dumbbell', kind: 'list',
  trim: 'y',
  daily: { order: 3, series: 4 },
  habitBucket: 'Top Priorities',
  keywords: ['workout', 'gym', 'run', 'lift', 'exercise', 'training'],
  buckets: ['Top Priorities', 'Routine', 'Goals', 'PRs'],
}
```

`habitBucket` is a new optional area field: the name of the one bucket (if
any) whose items check off like a habit instead of completing like a task.
Undefined for every other area — no behavior change anywhere else.

### View — bucket becomes the default, and decides the row

`src/views/AreaView.jsx`: the bucket tab state initializes to
`area.habitBucket ?? 'All'` instead of the hardcoded `'All'`. Every other
area still opens on "All", exactly as today. `AreaView` passes
`habitBucket={area.habitBucket}` down to `ItemList`.

`src/components/ItemList.jsx`: `SortableRow` gets one more prop,
`isPriority = habitBucket && item.bucket === habitBucket`. When true, the row
renders the Habits idiom instead of the task idiom:

- Check button calls `toggleHabitToday(item.id)`, active state computed the
  same reactive way `Habits.jsx` already does — subscribe to `logs`, check
  for a live `habit-check` log dated today for this item id. Not the
  store's non-reactive `isHabitCheckedToday` getter, which would not
  re-render on change.
- A streak badge next to the title via the existing, already area-agnostic
  `habitStreak(logs, item.id)` from `rewards.js`.
- Drag-reorder, inline title editing, and the details-sheet button are
  unchanged — only the leading check control and the trailing streak badge
  differ from the normal row.

Every other item — including every other Fitness item — keeps today's
`toggleDone`/checkbox row exactly as it is. A view mixing both (the "All"
tab, or any bucket other than the habit one) renders each row by its own
`bucket`, so nothing needs to know about the page as a whole.

### The fix itself — `rewards.js`

`countsForDate`'s non-journal, non-habits-kind branch sums both log kinds
for the area instead of only `complete`:

```js
} else {
  const complete = day ? day.get(`complete|${area.id}`) || 0 : 0
  const checks = day ? day.get(`habit-check|${area.id}`) || 0 : 0
  out[area.id] = complete + checks
}
```

This is deliberately additive, not a replacement: finishing a one-off PR or
goal still bumps the band once, exactly as today. Checking off a top
priority adds the repeatable part on top. Nothing you already track changes
behavior — the chart can only go up relative to today's baseline, never
down, for any existing data.

`buildBandIndex` needs no change — it already indexes every `complete` and
`habit-check` log by `${kind}|${areaId}` regardless of the area's `kind`
field. Only the per-band switch in `countsForDate` was narrow.

### Points

`computePoints` scores every live `habit-check` log at `POINTS.habit` (5),
regardless of area. A Fitness top-priority check-in already earns the same
5 points a Keystone Habit does, with no change required — `computePoints`
was never area-scoped in the first place.

## Explicitly out of scope

- Dashboard's "Today's keystones" section stays scoped to the Habits area
  only. Top priorities live on the Fitness page; they are not duplicated
  onto the dashboard.
- `item.type` is untouched and unused by this feature.
- No guard against re-bucketing an item into or out of the habit bucket
  mid-life. Its prior logs (whichever kind they are) simply stay as
  history; its behavior from that point follows its current bucket. This is
  an accepted, low-probability edge case, not a defect to engineer around.
- No cross-area generalization beyond the config field itself. Only Fitness
  gets a `habitBucket` today.

## Testing

- `src/lib/__tests__/rewards.test.js`: a `habit-check` log against a
  non-habits-kind area (`fitness`) counts into that band; a `complete` log
  and a `habit-check` log against the same area on the same day sum rather
  than override.
- `src/data/__tests__/areas.test.js`: fitness's `buckets` includes `'Top
  Priorities'` as the first entry, and `habitBucket` equals `'Top
  Priorities'`. Every other area's `habitBucket` is asserted undefined.
- `src/components/ItemList.jsx` gets no new unit tests, matching the
  existing convention: it uses hooks and this codebase never renders
  components in tests (see `AreaIcon.test.js` — components are called as
  plain functions, which a hook-using row cannot be). Verified instead by a
  manual browser check: open Fitness, confirm it lands on Top Priorities,
  add an item, check it, confirm the streak badge appears, confirm the
  dashboard's 7-day chart and 5-week grid both reflect it, uncheck it and
  confirm both reverse.
- Regression bar: `src/lib/__tests__/chart.test.js` must pass unchanged —
  it consumes `bandCounts`'s output shape, not its internals, and that
  shape does not change.
