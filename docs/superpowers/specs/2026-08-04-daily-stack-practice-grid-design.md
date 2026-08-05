# Daily stack + practice grid

Date: 2026-08-04
Status: approved design, not yet implemented

## Problem

The Dashboard's activity chart is a single flat bar per day — total logs, one
color, no breakdown. It answers "was I busy" but not "was I busy at the things
that matter daily." Four areas form a daily practice (Journal, Diet, Fitness,
Keystone Habits) and the chart can't distinguish them.

Two views are wanted, answering two different questions:

- **Daily stack** — "how much, and of what, today and this week?" (magnitude)
- **Practice grid** — "am I keeping the rhythm over the last five weeks?" (presence)

## Non-goals

- Fitness top-priority items. That is a separate spec; see Forward compatibility.
- Notifications, journal navigation, project restructuring. Separate specs.
- Any change to the four data primitives. This is a view over existing data.

## Architecture fit

No new primitive, no schema change, no migration. Every band is derivable from
data already written:

| Band    | Source                                                |
| ------- | ----------------------------------------------------- |
| Journal | NOTEs with `areaId:'journal'`, no `itemId`            |
| Diet    | LOGs `kind:'complete'`, `areaId:'diet'`               |
| Fitness | LOGs `kind:'complete'`, `areaId:'fitness'`            |
| Habits  | LOGs `kind:'habit-check'`                             |

Per CLAUDE.md's preference order (new area kind > new log kind > new view over
existing primitives), this is the third and cheapest case.

### Why journal counts NOTEs, not LOGs

`addNote` writes at most one `kind:'journal'` LOG per day — a day-marker used to
award the once-daily journal bonus (`store.js:158`). Counting that marker would
cap the journal band at 1 while habits can reach 6+, so on a magnitude stack
journaling would render as a permanent sliver regardless of how much was
written. Counting notes makes three entries show as three.

Consequence: journal is the only band sourced from NOTEs, so both data
functions take `(logs, notes)`. Notes have no `date` field — they carry a
`createdAt` timestamp — so they are bucketed with `todayKey(new Date(n.createdAt))`.

**Known limitation: cross-timezone day agreement.** This bucketing only agrees
with LOG `date` values on a single device in a single timezone. `LOG.date` is
frozen at WRITE time by the authoring device. NOTE has no `date` field, so the
journal band derives one at READ time using the *viewing* device's offset.
Across timezones the two can diverge: an entry written at 23:00 in Denver
lands on the 4th for a Denver viewer and the 5th for a London viewer, while a
diet completion logged the same minute stays on the 4th for both, because its
`date` was fixed at write time and travels with it unchanged.

This is not a sync bug — nothing here writes, `merge.js` is untouched, and
`createdAt` survives merges intact. It is a read-time interpretation gap. The
honest fix is a `date` field written on NOTE at creation time, matching how
LOG already works; that is a schema addition this design deliberately avoids
to stay a pure view over existing data. Revisit if a second timezone ever
enters the picture (e.g. multi-device use while traveling).

## Design

### 1. Config — `src/data/areas.js`

Four area rows gain a `daily` field. No other row changes.

```js
{ id: 'journal', …, trim: 'b', daily: { order: 1, series: 1 } },  // blue
{ id: 'diet',    …, trim: 'g', daily: { order: 2, series: 3 } },  // green
{ id: 'fitness', …, trim: 'y', daily: { order: 3, series: 4 } },  // amber
{ id: 'habits',  …, trim: 'r', daily: { order: 4, series: 2 } },  // red-orange
```

- `order` — 1..4, bottom-to-top in the stacked bar, top-to-bottom in a grid cell.
- `series` — index into the existing CVD-validated `--series-*` palette
  (`index.css:30-37`). 1/2/3/4 are the validated first four and are maximally
  separable as a set.
- Areas without `daily` are excluded from both views. Completing a bill or
  logging a book is real work but is not a daily rhythm.

Export a derived helper alongside `areaById`:

```js
export const DAILY_BANDS = AREAS.filter((a) => a.daily)
  .sort((a, b) => a.daily.order - b.daily.order)
```

**Trim realignment.** `journal` moves violet→`b`, `fitness` red→`y`, `habits`
yellow→`r`, so an area's nav/edge color matches its band color. Without this,
journal is violet in the nav and blue in the chart.

This forces a fourth change. `areas.test.js` asserts each trim is used at most
twice; moving `journal` to `b` would make `b` appear three times (projects,
learnings, journal). `learnings` therefore moves `b`→`o`, which no area
currently uses. Final assignment:

| Trim | Areas                  |
| ---- | ---------------------- |
| `b`  | projects, journal      |
| `g`  | diet                   |
| `o`  | learnings              |
| `r`  | health, habits         |
| `v`  | philosophy             |
| `y`  | finance, fitness       |

### 2. Data — `src/lib/rewards.js`

`activityByDay` is replaced by two pure functions. Both exclude tombstones
(`!deletedAt`) — the current `activityByDay` does not, so the existing chart
silently counts deleted logs. That bug dies with the function.

```js
dailyActivity(logs, notes, n = 7)
// -> [{ date: 'YYYY-MM-DD',
//       bands: { journal: 2, diet: 1, fitness: 0, habits: 4 },
//       total: 7 }]
// Oldest first. Every day in the window is present, including zero days.

dailyPresence(logs, notes, weeks = 5)
// -> [ [ { date, bands: { journal: true, … }, future: false }, …7 ], …5 ]
// Outer array = weeks, oldest first. Inner = Mon..Sun.
```

`dailyPresence` is `dailyActivity` thresholded at `> 0`, over a calendar-week
window rather than a rolling-day window.

**Week alignment.** Weeks run Monday–Sunday in local time. The window is the
current calendar week plus the four preceding it. As a new week begins the
oldest drops off — the block always shows exactly 5×7. Days after today in the
current week carry `future: true`; they are rendered as empty outline, not as
missed days.

A `startOfWeekKey(d = new Date())` helper handles the Monday offset
(`getDay()` returns 0 for Sunday, so the offset is `(day + 6) % 7`).

### 3. Components

**`src/components/DailyStack.jsx`** — replaces `ActivityChart.jsx`, same
Dashboard slot. `ActivityChart.jsx` is deleted; Dashboard is its only consumer.

- Stacked SVG bars, 7 days, band order bottom-to-top per `daily.order`.
- Oversized transparent hit target per day, plus a hover/tap tooltip listing
  all four band counts.
- `onMouseLeave` is bound to the `<svg>`, NOT to the per-column hit targets.
  Leaving one column and entering the next are separate native events, so a
  per-column handler renders a null frame between them and the tooltip blinks
  on every boundary crossing.
- **Gains a legend.** The old chart was single-series and named by its title;
  four series cannot be identified that way. Legend is icon + name + swatch,
  reusing `<AreaIcon>` so identity stays icon-and-name-first, with color as
  reinforcement — per the existing rule in `areas.js`.
- Zero-total days render a flat `--surface-3` baseline stub, as today.

**`src/components/PracticeGrid.jsx`** — new, below the stack.

- 5 rows × 7 columns, Monday–Sunday, newest week at the bottom.
- Each cell is four fixed slots in `daily.order`, constant height. A slot is
  filled with its band color if that band was touched that day, otherwise
  `--surface-3`. Constant height is the point: the grid reads as texture, so
  gaps and runs are visible at a glance.
- Weekday initials label the columns; no row labels.
- Tap/hover a cell for a fixed caption below the grid (`.pg-caption`) naming
  the date and which bands were touched, rather than a per-cell tooltip: a
  tooltip would overlay the very texture the grid exists to show.
- The caption element is ALWAYS rendered; only its text toggles. Its reserved
  `min-height` only holds layout steady while it is in the DOM, so mounting it
  conditionally shifted everything below it by 24px on every hover.
- `onMouseLeave` is bound to `.practice-grid`, NOT to the cells, for the same
  separate-events reason as the chart. With a per-cell handler the caption
  unmounted and remounted on every cell-to-cell move.

**No `<details>` data tables.** Both components originally carried a "View data"
table as an accessibility escape hatch. Removed 2026-08-04 at Ryan's request —
this is a single-user personal dashboard, and the tables were visual clutter
under every chart. Both views keep `role="img"` with a descriptive `aria-label`.
Restoring a tabular fallback is the obvious move if the app ever gains users
who need it.

**`src/views/Dashboard.jsx`** — the "Last 7 days" card now renders
`<DailyStack>`; a new "Last 5 weeks" card below it renders `<PracticeGrid>`.
Both read `notes` from the store in addition to `logs`.

### 4. Testing

`src/lib/__tests__/rewards.test.js` gains direct unit tests:

- Each band counts only its own source; no cross-contamination between areas.
- Tombstoned logs and notes are excluded from both functions.
- A journal day with three notes yields `bands.journal === 3`, not 1.
- Zero-activity days appear in the output with all bands at 0 (not skipped).
- `dailyPresence` returns exactly 5×7 cells; the current week's post-today
  cells are `future: true`; the oldest week is four weeks back.
- Week boundary: a log dated Sunday and one dated the following Monday land in
  different weeks.
- Notes are bucketed by local date from `createdAt`, matching LOG `date` keys.

`src/data/__tests__/areas.test.js` gains: exactly four areas carry `daily`;
`order` values are 1..4 with no duplicates; `series` values are unique.

No existing test covers `activityByDay`, and `Dashboard.jsx` is the sole
consumer of both it and `ActivityChart.jsx`, so both removals are clean.

**Components are not unit-tested, deliberately.** `vitest.config.js` sets
`environment: 'node'` with no jsdom, so a component that calls hooks throws if
invoked directly (`AreaIcon.test.js` works only because that component is
hook-free). This is why the stacked bar's geometry is extracted into a pure
`stackGeometry` helper in a new `src/lib/chart.js` and tested there: it moves
the only non-trivial component logic somewhere it can be exercised. The
components themselves are maps over tested data and are verified by hand.
Introducing jsdom is a reasonable follow-up but is a repo-wide config decision,
not part of this work.

## Forward compatibility

**Fitness priorities.** The fitness band currently counts any completion in the
Fitness area, including Goals and PRs items. The planned fitness top-priorities
feature is the intended source. When it lands, only the fitness branch of the
band-counting logic narrows to priority items — the band table, the components,
the grid, and the config are all untouched.

**A fifth daily area** is one config row in `areas.js`. Both components and
`rewards.js` iterate `DAILY_BANDS` — verified, nothing there hardcodes four.
`--series-5` through `--series-8` already exist in `index.css`, so no new
token is needed; what is owed is CVD re-validation of the palette as a
five-color set, not picking a new color. What *does* hardcode four is the test
suite: roughly seven expectations across `src/data/__tests__/areas.test.js`
and `src/lib/__tests__/rewards.test.js` assert on the literal four-band shape
(e.g. `['diet', 'fitness', 'habits', 'journal']`, `{ journal: 0, diet: 0,
fitness: 0, habits: 0 }`). Those tests need updating alongside the config row.

## Risks

- **Palette beyond four bands.** The `--series-*` palette is CVD-validated as a
  set; adding a fifth band means re-validating, not just picking a color.
- **Grid density on small screens.** 35 cells × 4 slots on a phone is tight.
  Slot height has a floor; if the cell cannot render four legible slots the
  grid should shrink its horizontal gutters before its slot height.
