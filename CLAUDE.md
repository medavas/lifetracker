# Stoa (folder still `lifetracker/`)

Personal life dashboard PWA (habits, journal, finance, fitness, etc.).

## Core architecture rule — do not violate it

THE APP HAS 4 PRIMITIVES, NOT 12 MODULES.

What looks like 9 sections (Projects, Finance, Fitness, Diet, Health,
Keystone Habits, Journal, Philosophy/Quotes, Learnings) is
really just filtered views over 4 data primitives:

1. **AREA** — static config only, never stored in the DB. One registry file
   (`src/data/areas.js`) where each area is a row: id, name, icon, kind
   (`'list' | 'habits' | 'journal' | 'library' | 'timers'`), bucket names
   (e.g. Finance has Bills/Insurance/Investments/Savings/Fixed/Variable/Goals), and fuzzy-match
   keywords. Adding a new life-area = adding a config row, zero new components.
   An area may also name a `habitBucket` — the one bucket (if any) whose
   items get Habit-style daily check-off instead of one-shot completion
   (e.g. Fitness's `habitBucket: 'Top Priorities'`).

2. **ITEM** — anything listed: a task, a habit, a book, a bill, a quote.
   `{ id, areaId, bucket, title, details, type, status: 'open'|'done'|'archived',
     order, createdAt, updatedAt, completedAt }`
   Nudge timers (`kind: 'timers'`) additionally carry `{ intervalMin, enabled }`
   — a deliberate two-scalar concession on ITEM rather than a 5th primitive.
   `bucket` is not purely a cosmetic label: when it matches the item's area's
   `habitBucket`, it determines which store action the UI wires the item to
   (`toggleHabitToday` instead of `toggleDone`) — moving an item into or out
   of that bucket switches its behavior with it, with no new ITEM field.

3. **LOG** — a dated record of something happening: habit check-in, item
   completion, journal-day marker.
   `{ id, itemId, areaId, kind, date: 'YYYY-MM-DD', createdAt }`

4. **NOTE** — freeform text: journal entries (areaId `'journal'`, no itemId) and
   per-item notes (has itemId).
   `{ id, areaId, itemId?, text, createdAt, updatedAt }`

## Consequences of this design — preserve them

- ONE generic AreaView component renders every 'list'/'library' area,
  parameterized by the area config. Never create a FinanceView, DietView, etc.
- Streaks and stats are always COMPUTED from logs, never stored, so they
  can't drift.
- Unchecking an item is NOT archiving. Uncheck = back to `'open'`. Archive is
  an explicit user action (soft delete). Hard delete needs confirmation.
- Reward points are reversible: unchecking takes back exactly what checking
  awarded (+10 item, +5 habit check, +15 first journal entry of the day).
- New features should be expressible as: a new area kind, a new log kind,
  or a new view over existing primitives — in that order of preference.
  If a feature seems to need a 5th primitive, stop and flag it.
