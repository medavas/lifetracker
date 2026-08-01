# Area consolidation: drop Work & Schedule, merge Budget into Finance

## Context

Stoa's areas are config rows in `src/data/areas.js` (see `CLAUDE.md`'s 4-primitive
rule — AREA is static config, never stored data). Trimming areas is a config-only
change: no schema change, no new area kind, no component change.

## Change

In `src/data/areas.js`:

1. **Remove `work`** (id `work`, icon Briefcase, buckets Now/Next/Waiting) —
   folded into Projects; no replacement row.
2. **Remove `schedule`** (id `schedule`, icon CalendarDays, buckets Today/This
   Week/Recurring) — deleted outright, no replacement row, no date/time bucket
   added anywhere else.
3. **Merge `budget` into `finance`** — keep id `finance`, name "Finance".
   - Buckets: `Bills, Insurance, Investments, Savings, Fixed, Variable, Goals`
     (union of both areas' buckets, order preserved: finance's buckets first,
     then budget's).
   - Keywords: union of both areas' keyword lists.
   - Remove the standalone `budget` row.
4. **Projects** (id `projects`) is unchanged — buckets stay `Active, Backlog,
   Someday`.

No other files change. `areaById`, `AreaView`, and all consumers are generic
over the `AREAS` array already.

## Data migration

None. Confirmed no real items exist under `work`, `schedule`, or `budget` in
current data, so no re-pointing of `areaId` values is needed.

## Result

12 nominal sections → 9 areas: Projects, Finance, Fitness, Diet, Health,
Keystone Habits, Journal, Philosophy & Quotes, Learnings.

## Testing

- Load the app, confirm the area list renders exactly the 9 areas above, in
  the array's declared order.
- Confirm Finance shows all 7 merged buckets and no orphaned Budget area
  remains in navigation.
- Confirm no console errors reference `areaById('work')`,
  `areaById('schedule')`, or `areaById('budget')` (grep the codebase for any
  hardcoded references to those ids before/after, since AREAS is normally the
  only place ids are defined).
