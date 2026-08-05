# Journal monthly-first navigation

Date: 2026-08-05

## Summary

Replace the flat "compose box + reverse-chronological list of every entry
ever" Journal page with a four-level drill-down: year list → month list →
day list → day detail. The default landing screen is the current month's
day list, scrolled to its bottom so today is immediately visible. Entries
become immutable once written — no edit, no delete, anywhere in this view.

This is a pure navigation and read-model redesign. No schema change, no new
primitive, no change to how an entry is stored or how the dashboard's daily
chart and 5-week grid compute journal activity.

## What doesn't change

- An entry is still a NOTE: `{ areaId: 'journal', itemId: null, text,
  createdAt, updatedAt, deletedAt }`. `addNote('journal', text)` is called
  exactly as it is today, including the `kind: 'journal'` day-marker LOG it
  writes and the first-entry-of-the-day bonus in `computePoints`.
- `dailyActivity`/`dailyPresence` in `rewards.js` already read journal
  activity from NOTEs independent of the Journal page's own navigation UI —
  nothing here touches them.
- The "also file this as an item elsewhere" fuzzy-match chips on the compose
  box carry over unchanged.
- `store.js`'s `updateNote`/`deleteNote` are not deleted. `Journal.jsx` is
  their only current caller anywhere in the codebase — after this change
  they have zero callers. Removing unused store actions is a separate,
  smaller cleanup and is explicitly out of scope here: this spec is a
  navigation redesign, not a store audit, and leaving a capability in place
  costs nothing.

## Immutability

Once written, an entry is permanent. No edit or delete control appears
anywhere in the redesigned Journal — including immediately after writing
today's entry. This was a deliberate, confirmed decision, not an oversight:
the existing inline-edit-and-delete UI in `Journal.jsx` is removed entirely,
not narrowed to "past days only."

## Navigation: four levels, four routes

Each level gets its own route so browser back and deep links both work
without relying on in-app history depth:

| Level | Shows | Route |
| --- | --- | --- |
| Year list | Every year with at least one entry, as buttons, plus always the current year | `/journal/years` |
| Month list | All 12 months of one year, as buttons; entries mark which have activity | `/journal/years/:year` |
| Day list | Every day of one month, oldest to newest, scrolled to the bottom on mount | `/journal/years/:year/:month` |
| Day detail | That day's entries, read-only, chronological | `/journal/years/:year/:month/:day` |

`/journal` becomes a redirect to `/journal/years/<current year>/<current
month>` (1-indexed month, matching `Date#getMonth() + 1`), computed at
render time from `new Date()`. `src/views/Journal.jsx` shrinks to just this
redirect; `BottomNav`/`AreasGrid` keep linking to `/journal` unchanged.

Each screen has one back-button to the level directly above it, styled like
`AreaView`'s existing `.back-btn`. It navigates to an explicitly computed
parent path (e.g. Day list's back button always goes to
`/journal/years/:year`), not `navigate(-1)` — so it's correct on a fresh
deep link or page reload, not just when arrived at by drilling down.

### Why a list, not a calendar grid

The ask was to scroll to reach today and to see "the list of months as
buttons" — that's a vertical list, not a 7-column calendar grid (which fits
on one screen and needs no scrolling). Day list renders every day of the
month top-to-bottom as rows, not as a grid. Only days with at least one
entry are marked and clickable; today is visually distinct but only
clickable once it has an entry — writing one is done via the compose box on
this same screen, not by clicking an empty "today" row.

Month list always renders all 12 buttons (Jan–Dec), calendar-like — you can
browse into an empty month and see an empty day list. Year list is
different: it only lists years that actually have an entry, because unlike
months-within-a-year there is no natural bound on how far back an empty
list could stretch. The current year is always included even with zero
entries yet, so there is always a path down to today from a fresh install.

### Composing

The compose box appears on the Day list screen only when that screen
represents the current month — persistent and always visible, matching
today's existing feel, not gated behind clicking a specific day. Writing an
entry immediately makes today's row in the list marked/clickable.

## New pure module — `src/lib/journalCalendar.js`

All date-bucketing logic lives here, fully unit-testable, no DOM:

```js
yearsWithEntries(notes) -> string[]              // ascending, always includes the current year
monthEntryFlags(notes, year) -> boolean[12]       // index 0 = January
daysInMonth(notes, year, month) -> boolean[]      // sized to that month's real day count (28-31)
entriesForDay(notes, year, month, day) -> Note[]  // chronological, oldest first
```

`year` is a 4-digit string (`'2026'`); `month` is 1-indexed (`8` for
August), matching the route params directly with no off-by-one translation
at the call site. Each function filters the raw `notes` array internally to
`n.areaId === 'journal' && !n.itemId && !n.deletedAt` — the same predicate
`selectJournal` already uses in `store.js` — so view components never touch
NOTE internals directly, only these four functions.

`entriesForDay` sorts oldest-first (chronological reading order within a
single day), which is the opposite of `selectJournal`'s existing
newest-first sort across all days. This is intentional: a single day's
entries read like a diary page, top to bottom in the order they were
written; the reverse-chronological convention that made sense for an
unbounded flat list stops applying once you've already navigated to one
specific day.

**Route params vs. internal day keys — do not conflate these.** Route
segments for month and day are unpadded integers as strings (`'8'`, not
`'08'`; `'4'`, not `'04'`) — this is purely a URL-readability choice.
Internally, matching a note to a specific day still uses the zero-padded
`'YYYY-MM-DD'` key `todayKey()` already produces elsewhere in this codebase
(`rewards.js`). `journalCalendar.js`'s functions take the unpadded route
values and pad them internally before comparing against a note's derived
day key — the padding conversion belongs entirely inside this module, never
in a view component.

## Files

New:
- `src/lib/journalCalendar.js` — the pure module above.
- `src/views/journal/YearList.jsx`
- `src/views/journal/MonthList.jsx`
- `src/views/journal/DayList.jsx`
- `src/views/journal/DayDetail.jsx`

All four reuse existing CSS (`.page-head`, `.back-btn`, `.card`,
`.empty-note`, `.bucket-tab`-style buttons) — no new styles beyond what a
day row and a day-detail entry card need, and those should be composed from
existing primitives (`.card`, `.note-card`, `.note-date`, `.note-text` from
the current `Journal.jsx` are candidates to carry forward for the entry
display in `DayDetail`).

Modified:
- `src/views/Journal.jsx` — replaced with the redirect.
- `src/App.jsx` — the single `/journal` route stays; four new routes added
  for the levels above.

## Testing

`src/lib/__tests__/journalCalendar.test.js` — full coverage of the four pure
functions: empty-notes baseline, year/month/day boundaries (a note on the
last day of a month, a note in December vs. January, a leap-year February),
the current-year-always-included rule, tombstoned and per-item notes
excluded, chronological ordering within `entriesForDay`.

The four view components get no unit tests, matching this codebase's
established convention that hook-using components are not rendered in
tests. Verified instead by a manual browser check: default landing on the
current month scrolled to today; a day with entries opens a read-only,
chronological, edit-free detail view; composing from the day list works and
immediately marks today; a day with no entries is not clickable; back
navigates correctly at every level; a fresh install with zero journal
entries still shows the current year in the year list and lands correctly
on an empty current-month day list with a working compose box.

## Explicitly out of scope

- Deleting the now-unused `updateNote`/`deleteNote` store actions.
- Any change to how journal activity is counted toward points, the daily
  chart, or the 5-week practice grid.
- A calendar-grid (7-column) rendering of any level. All three drill-down
  levels are lists, per the design above.
- Editing or deleting an entry from anywhere, including a dedicated
  "recently written, still editable" grace window.
