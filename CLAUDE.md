# Stoa (folder still `lifetracker/`)

Personal life dashboard PWA (habits, journal, finance, fitness, etc.).

## Core architecture rule — do not violate it

THE APP HAS 4 PRIMITIVES, NOT 12 MODULES.

What looks like 9 sections (Projects, Finance, Fitness, Diet, Health,
Keystone Habits, Journal, Philosophy/Quotes, Learnings) is
really just filtered views over 4 data primitives:

1. **AREA** — static config only, never stored in the DB. One registry file
   (`src/data/areas.js`) where each area is a row: id, name, icon, kind
   (`'list' | 'habits' | 'journal' | 'library' | 'timers' | 'money'`), bucket names
   (e.g. Finance has Plan/Bills/Subscriptions/Spending/Goals/Other), and fuzzy-match
   keywords. Adding a new life-area = adding a config row, zero new components.
   An area may also name a `habitBucket` — the one bucket (if any) whose
   items get Habit-style daily check-off instead of one-shot completion
   (e.g. Fitness's `habitBucket: 'Top Priorities'`).

2. **ITEM** — anything listed: a task, a habit, a book, a bill, a quote.
   `{ id, areaId, bucket, title, details, type, status: 'open'|'done'|'archived',
     order, createdAt, updatedAt, completedAt }`
   Nudge timers (`kind: 'timers'`) additionally carry `{ intervalMin, enabled }`
   — a deliberate two-scalar concession on ITEM rather than a 5th primitive.
   Finance (money) items additionally carry { amount, cadence, nextDue }
   and money LOGs carry { amount, note?, prevDue? } — the same deliberate
   concession, cents-integer amounts, no 5th primitive.
   A project sub-task additionally carries `{ parentId }` — the same kind of
   concession, one level of nesting only: a sub-task cannot itself have
   sub-tasks (enforced in `addItem`, not just by convention).
   The workout program is ITEMs too, and reuses that same nesting rather than
   inventing anything: a training day is a parent item in the `'Sessions'`
   bucket carrying `{ weekday }`, and each exercise is one of its sub-items
   carrying `{ sets, low, high, step }`. `step` is the SIGNED weight jump
   taken when a rep range tops out — negative means an assistance machine,
   where less weight is progress, which is why there is no separate boolean.
   This is what makes the whole plan editable in the UI; `data/workoutProgram.js`
   is only the seed `seedWorkoutProgram()` builds once, never the live plan.
   `bucket` is not purely a cosmetic label: when it matches the item's area's
   `habitBucket`, it determines which store action the UI wires the item to
   (`toggleHabitToday` instead of `toggleDone`) — moving an item into or out
   of that bucket switches its behavior with it, with no new ITEM field.

3. **LOG** — a dated record of something happening: habit check-in, item
   completion, journal-day marker.
   `{ id, itemId, areaId, kind, date: 'YYYY-MM-DD', createdAt }`
   Money logs additionally carry `{ amount, note?, prevDue? }`.
   A workout set (`kind: 'set'`) additionally carries `{ weight, reps }` —
   the same deliberate scalar concession, one log per set — and its `itemId`
   is the exercise item it was performed on.

4. **NOTE** — freeform text: journal entries (areaId `'journal'`, no itemId) and
   per-item notes (has itemId).
   `{ id, areaId, itemId?, text, createdAt, updatedAt }`

## Consequences of this design — preserve them

- ONE generic AreaView component renders every 'list'/'library' area,
  parameterized by the area config. Never create a DietView, HealthView, etc.
  Three areas have their own page, each wired the same way — an `areas.js`
  `route` field, never a branch in a ternary — and each for the same narrow
  reason: their unit of work cannot be expressed as a flat list row.
  Finance (`views/FinanceDashboard.jsx`, the 'money' kind) owns dated cash
  movement; Projects (`views/Projects.jsx` + `views/projects/*`) owns a
  per-item checklist and notes feed; Fitness (`views/Fitness.jsx` +
  `components/fitness/*`) owns sets of weight x reps against an editable
  program. That test — "a row genuinely cannot hold this" — is the bar, and
  three passing it is not a licence for a fourth. Fitness in particular is
  still an ordinary `kind: 'list'` area underneath: its items, buckets,
  `habitBucket` check-off and daily band all still run through the shared
  machinery, and its page renders `ItemList` for exactly that. Program items
  and tracking items share the area without ever mixing: a program item is
  either in the `'Sessions'` bucket or hangs off one by `parentId`, and the
  Tracking tabs filter both out.
- Streaks and stats are always COMPUTED from logs, never stored, so they
  can't drift.
- Unchecking an item is NOT archiving. Uncheck = back to `'open'`. Archive is
  an explicit user action (soft delete). Hard delete needs confirmation.
- Reward points are reversible: unchecking takes back exactly what checking
  awarded (+10 item, +5 habit check, +15 first journal entry of the day).
- New features should be expressible as: a new area kind, a new log kind,
  or a new view over existing primitives — in that order of preference.
  If a feature seems to need a 5th primitive, stop and flag it.
- Journal NOTEs are immutable once written. No edit or delete UI anywhere.
  `updateNote`/`deleteNote` remain in `store.js` with zero callers —
  deliberately, not by accident. Do not wire them back up.
