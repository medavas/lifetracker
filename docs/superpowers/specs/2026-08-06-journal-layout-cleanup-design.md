# Journal layout cleanup + always-available today compose

Date: 2026-08-06

## Summary

Follow-up to the [2026-08-05 monthly-nav redesign](2026-08-05-journal-monthly-nav-design.md).
That redesign introduced Year list → Month list → Day list → Day detail
drill-down, but left two problems: Year list and Month list render their
buttons as small content-width pills (`.bucket-tab` in a wrapping
`.button-grid`), which leaves large empty gaps on every row; and every
month in Month list is clickable regardless of whether it has any entries.
This is a pure view/CSS change — no schema, no new primitive, no change to
`journalCalendar.js`.

## Changes

### 1. Shared `TodayCompose` component

Extract the compose box (textarea, "also file this as" chips, save button,
hint text) currently inlined in `DayList.jsx` into
`src/views/journal/TodayCompose.jsx`. It owns its own `draft`/`alsoFile`
state and calls `addNote('journal', draft)` exactly as today — it always
writes to *today's* date, regardless of which year/month/day the user
happens to be browsing when they use it.

`TodayCompose` renders unconditionally at the top of all four journal
screens: YearList, MonthList, DayList, DayDetail. `DayList` drops its
current `isCurrentMonth` gate around the compose box — previously it only
showed while viewing the current month; now it always shows, since writing
today's entry should never require navigating to any particular screen.

### 2. Month list interactivity

All 12 months keep rendering every time (calendar-like, so the shape of a
year stays visible) — this part of the original design doesn't change. What
changes is clickability: a month is clickable only if `monthEntryFlags(notes,
year)[i]` is true, **or** it is the current month (mirroring the exception
`yearsWithEntries` already makes for the current year). Every other month
renders as a plain inert element — muted text, no cursor-pointer, no
`Link`/`onClick` — not a disabled-looking button.

### 3. Year list interactivity

No logic change. `yearsWithEntries` already returns only populated years
plus always the current year, so every row it produces is already meant to
be clickable — there is nothing to make inert here.

### 4. Layout

- **Year list**: replace the `.bucket-tab` pill grid with a vertical list of
  full-width rows, reusing the existing day-row visual language
  (`.item-row` family: left accent border, `--area-c1`, `--radius-sm`,
  `--shadow-card`). The current year gets a `.current` modifier for the
  same kind of highlight `.day-row.today` already gets in Day list.
- **Month list**: same full-width row style, one column, on mobile
  (default, below 900px). At `≥900px` — the breakpoint this app already
  uses for switching on the desktop sidebar — it becomes a 4-column ×
  3-row grid of larger cards instead of a vertical list.
- Inert months reuse the existing muted-text convention from
  `.day-row:not(.has-entry)` (color: `var(--text-muted)`, no pointer
  cursor).
- This removes the whitespace problem directly: `.bucket-tab` buttons are
  content-width inside a wrapping flex row, so a handful of short labels
  (year numbers, month names) leaves large empty gaps per row. Full-width
  rows and a fixed 4-column grid both use the full row width.

New CSS (in `App.css`, journal section): `.year-row`, `.month-row` (shared
full-width row look), `.month-row.inert`, `.month-row.current` /
`.year-row.current`, and a `≥900px` override switching `.month-list` from a
single column to `grid-template-columns: repeat(4, 1fr)`. The existing
`.bucket-tab`/`.button-grid` classes are left alone (still used elsewhere,
e.g. `AreaView`'s bucket tabs) — Year list and Month list simply stop using
them.

## What doesn't change

- `journalCalendar.js`'s four pure functions (`yearsWithEntries`,
  `monthEntryFlags`, `daysInMonth`, `entriesForDay`) — no signature or
  behavior change, no new tests needed there.
- Day list's day-row behavior: only days with an entry are shown at all
  (unchanged from the 08-05 design) — this spec doesn't touch Day list's
  clickability rule, only adds `TodayCompose` unconditionally and removes
  the `isCurrentMonth` gate that used to wrap it.
- Day detail stays read-only for the entries it displays; `TodayCompose` is
  added above that list but has no effect on the displayed day's own
  entries (it always targets today, per point 1).
- Immutability, routes, points/rewards, dashboard chart/grid computation —
  all untouched, per the 08-05 spec's existing "what doesn't change"
  section, still true here.

## Files

Modified:
- `src/views/journal/YearList.jsx` — vertical row list instead of pill
  grid; add `TodayCompose`.
- `src/views/journal/MonthList.jsx` — inert rendering for unpopulated
  non-current months; row/grid layout; add `TodayCompose`.
- `src/views/journal/DayList.jsx` — remove inline compose box (moved out),
  render `TodayCompose` unconditionally.
- `src/views/journal/DayDetail.jsx` — add `TodayCompose`.
- `src/App.css` — new row/grid styles described above.

New:
- `src/views/journal/TodayCompose.jsx`.

## Testing

No changes to `journalCalendar.js`, so its existing unit tests stand
unmodified. Per this codebase's convention, the view components (all of
which use hooks) get no unit tests; verified by manual browser check
instead:

- Fresh install (zero journal entries): Year list shows only the current
  year, clickable; Month list for that year shows the current month
  clickable and every other month inert; `TodayCompose` on both screens
  successfully writes today's entry.
- A past year/month with entries: its row/cell is clickable; a past month
  with zero entries in a populated year renders inert (no click, muted).
- Composing from Year list, Month list, or a past Day detail (not the
  current-month Day list) still lands the new entry on *today's* date, not
  on whatever period is being browsed.
- Resizing the window across the 900px breakpoint flips Month list between
  the vertical list and the 4×3 grid.
- Day list still only lists days that have an entry; today's row still
  appears/updates immediately after composing while viewing the current
  month.

## Explicitly out of scope

- Any change to `journalCalendar.js` or the NOTE/LOG data model.
- Changing Day list's "only populated days are listed" rule.
- A calendar-grid rendering of Day list (still a list, per the 08-05 spec).
- Editing or deleting entries (still fully out of scope, per 08-05).
