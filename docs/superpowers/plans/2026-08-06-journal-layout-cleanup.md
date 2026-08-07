# Journal Layout Cleanup + Always-Available Today Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Journal's Year list and Month list so they no longer waste
space on content-width pill buttons, make unpopulated months non-clickable,
and let the user write today's entry from any of the four Journal screens
(Year list, Month list, Day list, Day detail), not just the current month's
Day list.

**Architecture:** Extract the existing compose box out of `DayList.jsx`
into a standalone `TodayCompose` component and render it unconditionally on
all four Journal view components. Restyle Year list and Month list from a
wrapping row of small pill buttons (`.bucket-tab` / `.button-grid`) to
full-width rows (reusing the existing `.item-row` look), with Month list
switching to a 4-column grid at the app's existing `≥900px` desktop
breakpoint. Month list additionally makes any month with no entries (other
than the current month) render as a plain inert element instead of a link.

**Tech Stack:** React (function components + hooks), react-router-dom,
zustand (`useStore`), plain CSS in `src/App.css`. No new dependencies.

## Global Constraints

- No changes to `src/lib/journalCalendar.js` — its four exported functions
  (`yearsWithEntries`, `monthEntryFlags`, `daysInMonth`, `entriesForDay`)
  keep their current signatures and behavior, per the spec.
- No changes to the NOTE/LOG data model, routes, immutability rules, or
  points/rewards computation.
- Journal view components (`YearList`, `MonthList`, `DayList`,
  `DayDetail`, and the new `TodayCompose`) get no unit tests, matching this
  codebase's existing convention that hook-using view components aren't
  rendered in tests (see `src/views/__tests__/Journal.test.js`'s comment:
  only the hook-free `Journal.jsx` redirect is tested). Verification for
  every task in this plan is: `npm run lint`, `npm test` (must stay green —
  these don't cover the changed files but must not regress), and a
  described manual browser check.
- Desktop breakpoint is `≥900px`, matching the existing `@media
  (min-width: 900px)` block in `src/App.css` that turns on the sidebar.
- Each task must land a fully working, independently verifiable state —
  CSS for a task's own visual claims ships in that same task, not deferred
  to a later one.

---

## File Structure

- `src/views/journal/TodayCompose.jsx` (new) — the compose box (textarea +
  "also file as" chips + save button), self-contained, always writes to
  today's date via `addNote('journal', text)`.
- `src/views/journal/DayList.jsx` (modified) — drops its inline compose
  box and the `isCurrentMonth` gate around it; renders `<TodayCompose />`
  unconditionally. Day-row list logic (only populated days shown, `.today`
  highlight) is unchanged.
- `src/views/journal/YearList.jsx` (modified) — renders `<TodayCompose />`;
  replaces the `.bucket-tab`/`.button-grid` pill row with a vertical list
  of full-width rows (`.item-row.year-row`), current year gets `.current`.
- `src/views/journal/MonthList.jsx` (modified) — renders `<TodayCompose
  />`; replaces the pill grid with `.item-row.month-row` rows inside a new
  `.month-list` container; a month is clickable (rendered as a `Link`)
  only if it has an entry or is the current month, otherwise it's an inert
  `<div>`.
- `src/views/journal/DayDetail.jsx` (modified) — renders `<TodayCompose
  />` above its read-only entry list. No other change.
- `src/App.css` (modified across Tasks 1-3) — new rules for
  `.journal-compose` spacing, `.year-row`/`.month-row` current/inert
  modifiers, and the `.month-list` container including its `≥900px` grid
  override.

---

### Task 1: Extract `TodayCompose` and wire it into Day list

**Files:**
- Create: `src/views/journal/TodayCompose.jsx`
- Modify: `src/views/journal/DayList.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `TodayCompose` — a default-exported React component, no
  props, no children. Every later task imports it as `import TodayCompose
  from './TodayCompose'` and renders `<TodayCompose />` with no arguments.

- [ ] **Step 1: Create `src/views/journal/TodayCompose.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { suggestAreas } from '../../lib/fuzzy'
import AreaIcon from '../../components/AreaIcon'

/**
 * Compose box for today's journal entry. Rendered on every Journal screen
 * (Year list, Month list, Day list, Day detail) -- always writes to
 * *today's* date via addNote, regardless of which year/month/day the user
 * is currently browsing.
 */
export default function TodayCompose() {
  const addNote = useStore((s) => s.addNote)
  const addItem = useStore((s) => s.addItem)

  const [draft, setDraft] = useState('')
  const [alsoFile, setAlsoFile] = useState([])

  const related = useMemo(() => suggestAreas(draft).filter((a) => a.kind !== 'journal'), [draft])

  const save = () => {
    if (!draft.trim()) return
    addNote('journal', draft)
    for (const areaId of alsoFile) addItem(areaId, draft.split('\n')[0].slice(0, 120))
    setDraft('')
    setAlsoFile([])
  }

  return (
    <div className="journal-compose">
      <textarea
        value={draft}
        placeholder="What happened? What's true today?"
        onChange={(e) => setDraft(e.target.value)}
      />
      {related.length > 0 && (
        <div className="link-chips">
          {related.map((a) => (
            <button
              key={a.id}
              className={`chip ${alsoFile.includes(a.id) ? 'on' : ''}`}
              onClick={() =>
                setAlsoFile((prev) =>
                  prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                )
              }
            >
              <AreaIcon name={a.icon} size={13} /> {a.name}
            </button>
          ))}
        </div>
      )}
      <div className="compose-foot">
        <span className="hint">
          {related.length > 0 ? 'Tap a chip to also file this as an item there.' : 'First entry of the day earns bonus points.'}
        </span>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/views/journal/DayList.jsx` with the version below**

This removes the inline compose box (now in `TodayCompose`), drops the
`isCurrentMonth` gate around it, and drops the now-unused
`addNote`/`addItem`/`suggestAreas`/`AreaIcon` imports and `draft`/`alsoFile`
state. The day-row list rendering (only populated days shown, `.today`
highlight, scroll-to-bottom on mount) is unchanged.

```jsx
import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { daysInMonth } from '../../lib/journalCalendar'
import TodayCompose from './TodayCompose'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const weekdayOf = (year, month, dayNum) =>
  new Date(Number(year), Number(month) - 1, dayNum).toLocaleDateString(undefined, { weekday: 'long' })

/**
 * Default Journal landing screen: only days with a live entry are listed,
 * oldest at the top, scrolled to the bottom on mount so the most recent
 * entry is immediately visible. A day with no entry does not appear at
 * all. TodayCompose always writes to today, regardless of which month is
 * being viewed here.
 */
export default function DayList() {
  const { year, month } = useParams()
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))

  const flags = useMemo(() => daysInMonth(notes, year, month), [notes, year, month])

  const now = new Date()
  const isCurrentMonth = year === String(now.getFullYear()) && Number(month) === now.getMonth() + 1
  const today = now.getDate()

  // Scrolled to the bottom on landing, per the design: this is a plain
  // page-flow list, not an inner scroll container, matching every other
  // view in this codebase.
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight })
  }, [])

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate(`/journal/years/${year}`)}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
        <h1>{MONTH_NAMES[Number(month) - 1]} {year}</h1>
      </div>

      <TodayCompose />

      <div className="item-list">
        {flags
          .map((hasEntry, i) => ({ hasEntry, dayNum: i + 1 }))
          .filter((d) => d.hasEntry)
          .map(({ dayNum }) => {
            const isToday = isCurrentMonth && dayNum === today
            const rowClass = `item-row day-row has-entry ${isToday ? 'today' : ''}`
            return (
              <Link key={dayNum} to={`/journal/years/${year}/${month}/${dayNum}`} className={rowClass}>
                <span className="item-title">
                  {dayNum}{' · '}{weekdayOf(year, month, dayNum)}{isToday ? ' · Today' : ''}
                </span>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add compose spacing to `src/App.css`**

Find the existing Journal section (`/* ── Journal ─────... */`, currently
containing `.journal-compose textarea`, `.compose-foot`, and
`.btn-primary`) and add this rule directly above `.journal-compose
textarea`:

```css
.journal-compose { margin-bottom: 16px; }
```

This replaces the old per-file `style={{ marginTop: 16 }}` that used to sit
on Day list's item-list wrapper (now removed above) — spacing is now
consistent on every screen that renders `TodayCompose`, without each view
having to repeat it.

- [ ] **Step 4: Run the test suite and lint**

Run: `npm test`
Expected: PASS (no test covers these files directly, but the suite must
stay green — this confirms nothing else imports the removed DayList
exports/state in a way that breaks).

Run: `npm run lint`
Expected: no new errors in `src/views/journal/TodayCompose.jsx` or
`src/views/journal/DayList.jsx`.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open the app, navigate to `/journal` (lands on the
current month's Day list). Confirm: the compose box still renders and
still works (type text, save, see today's row appear/update in the list
below), with a clean 16px gap below it before the day rows start. Then
manually visit a past month's URL, e.g. `/journal/years/2026/1` — confirm
the compose box now renders there too (previously it was hidden for
non-current months), and that saving from there still lands the entry on
*today's* date (check by navigating back to the current month and seeing
the new entry there, not in January).

- [ ] **Step 6: Commit**

```bash
git add src/views/journal/TodayCompose.jsx src/views/journal/DayList.jsx src/App.css
git commit -m "refactor(journal): extract TodayCompose, show it unconditionally on Day list"
```

---

### Task 2: Year list — vertical rows + TodayCompose

**Files:**
- Modify: `src/views/journal/YearList.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `TodayCompose` (default export, no props) from Task 1;
  `yearsWithEntries(notes) -> string[]` from `src/lib/journalCalendar.js`
  (unchanged).

- [ ] **Step 1: Replace `src/views/journal/YearList.jsx` with the version below**

```jsx
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { yearsWithEntries } from '../../lib/journalCalendar'
import TodayCompose from './TodayCompose'

/** Top of the drill-down: every year with a live entry, plus always the current year. */
export default function YearList() {
  const notes = useStore(useShallow((s) => s.notes))
  const years = useMemo(() => yearsWithEntries(notes), [notes])
  const currentYear = String(new Date().getFullYear())

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head"><h1>Journal</h1></div>

      <TodayCompose />

      <div className="item-list">
        {years.map((y) => (
          <Link
            key={y}
            to={`/journal/years/${y}`}
            className={`item-row year-row ${y === currentYear ? 'current' : ''}`}
          >
            <span className="item-title">{y}{y === currentYear ? ' · This year' : ''}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the current-year highlight rule to `src/App.css`**

Add this rule in the Journal section, after `.journal-compose { margin-bottom: 16px; }`:

```css
.year-row.current .item-title { font-weight: 600; }
```

- [ ] **Step 3: Run the test suite and lint**

Run: `npm test` — Expected: PASS.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 4: Manual check**

With `npm run dev` running, open `/journal/years`. Confirm every listed
year is now a full-width row (not a small pill) with no leftover empty
space to its right, the current year's label is bold with the "· This
year" suffix, and `TodayCompose` renders above the list and still saves
correctly.

- [ ] **Step 5: Commit**

```bash
git add src/views/journal/YearList.jsx src/App.css
git commit -m "feat(journal): vertical year list rows, add TodayCompose"
```

---

### Task 3: Month list — inert unpopulated months + responsive layout

**Files:**
- Modify: `src/views/journal/MonthList.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `TodayCompose` (Task 1); `monthEntryFlags(notes, year) ->
  boolean[12]` from `src/lib/journalCalendar.js` (unchanged, index 0 =
  January).

- [ ] **Step 1: Replace `src/views/journal/MonthList.jsx` with the version below**

```jsx
import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { monthEntryFlags } from '../../lib/journalCalendar'
import TodayCompose from './TodayCompose'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * All 12 months of one year, calendar-like -- every month always renders.
 * A month is clickable only if it has at least one entry or is the
 * current month; every other month renders as a plain inert element.
 */
export default function MonthList() {
  const { year } = useParams()
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))
  const flags = useMemo(() => monthEntryFlags(notes, year), [notes, year])

  const now = new Date()
  const isCurrentYear = year === String(now.getFullYear())
  const currentMonthIndex = now.getMonth()

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate('/journal/years')}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
        <h1>{year}</h1>
      </div>

      <TodayCompose />

      <div className="month-list">
        {MONTH_NAMES.map((name, i) => {
          const isCurrent = isCurrentYear && i === currentMonthIndex
          const clickable = flags[i] || isCurrent
          const rowClass = `item-row month-row ${clickable ? '' : 'inert'} ${isCurrent ? 'current' : ''}`
          const label = <span className="item-title">{name}{isCurrent ? ' · This month' : ''}</span>

          return clickable ? (
            <Link key={name} to={`/journal/years/${year}/${i + 1}`} className={rowClass}>
              {label}
            </Link>
          ) : (
            <div key={name} className={rowClass}>
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add month-row and month-list rules to `src/App.css`**

Add these rules in the Journal section, after the `.year-row.current`
rule added in Task 2:

```css
.month-row.current .item-title { font-weight: 600; }
.month-row.inert { cursor: default; }
.month-row.inert .item-title { color: var(--text-muted); }

.month-list { display: flex; flex-direction: column; gap: 8px; }

@media (min-width: 900px) {
  .month-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .month-list .item-row {
    flex-direction: column; justify-content: center; text-align: center;
    padding: 20px 12px; border-left: none; border-top: 3px solid var(--area-c1, var(--border));
  }
}
```

`.month-list` is a distinct container class from `.item-list` specifically
so this `≥900px` grid override doesn't leak into other pages that reuse
`.item-list` (task lists, habit lists, etc.).

- [ ] **Step 3: Run the test suite and lint**

Run: `npm test` — Expected: PASS.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 4: Manual check (mobile width)**

With the dev server running and the browser narrower than 900px, open a
year with a mix of populated and empty months (or a fresh-install year
with only the current month populated). Confirm: all 12 months render as
one full-width row each; populated months and the current month are
clickable (current month bold with "· This month"); every other month is
visibly muted and does nothing when clicked/tapped.

- [ ] **Step 5: Manual check (desktop width)**

Widen the browser past 900px on the same page. Confirm the 12 months now
render as a 4-column × 3-row grid instead of a vertical list, with the
same clickable/inert distinction preserved and cards centered/top-accented
rather than left-accented rows.

- [ ] **Step 6: Commit**

```bash
git add src/views/journal/MonthList.jsx src/App.css
git commit -m "feat(journal): inert unpopulated months, responsive month grid, add TodayCompose"
```

---

### Task 4: Day detail — add TodayCompose, then full regression pass

**Files:**
- Modify: `src/views/journal/DayDetail.jsx`

**Interfaces:**
- Consumes: `TodayCompose` (Task 1).

- [ ] **Step 1: Replace `src/views/journal/DayDetail.jsx` with the version below**

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { entriesForDay } from '../../lib/journalCalendar'
import TodayCompose from './TodayCompose'

/**
 * Read-only: one day's journal entries. No edit, no delete -- once written,
 * an entry is permanent. TodayCompose above the list always writes to
 * today, not to the day being viewed here.
 */
export default function DayDetail() {
  const { year, month, day } = useParams()
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))
  const entries = entriesForDay(notes, year, month, day)

  const dateLabel = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate(`/journal/years/${year}/${month}`)}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
        <h1>{dateLabel}</h1>
      </div>

      <TodayCompose />

      {entries.length === 0 && <div className="empty-note">No entries on this day.</div>}

      {entries.map((n) => (
        <div key={n.id} className="card note-card">
          <div className="note-date">
            {new Date(n.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className="note-text">{n.text}</div>
        </div>
      ))}
    </div>
  )
}
```

`.note-card` already has `margin-top: 10px` (see `src/App.css`), and
`TodayCompose`'s own `margin-bottom: 16px` (added in Task 1) gives correct
spacing before the entries — no new CSS needed for this file.

- [ ] **Step 2: Run the test suite, lint, and build**

Run: `npm test` — Expected: PASS.
Run: `npm run lint` — Expected: no new errors.
Run: `npm run build` — Expected: succeeds (confirms no build-breaking
syntax across all the CSS/JSX changes in this plan).

- [ ] **Step 3: Manual check — Day detail**

Open a past day that has entries (drill down Year → Month → a populated
day). Confirm `TodayCompose` renders above the read-only entry cards with
correct spacing, and that saving from this screen adds an entry to
*today*, not to the past day being displayed (its entry list must not
change on save).

- [ ] **Step 4: Manual regression pass across all four screens**

With `npm run dev` running, walk through every screen once more end to
end, now that all four are in place together:
1. `/journal/years` — vertical year rows, no leftover pill whitespace,
   current year bold, `TodayCompose` visible and functional.
2. `/journal/years/<current year>` at mobile width — vertical month rows,
   inert months muted, current month bold and clickable even with 0
   entries.
3. Same page widened past 900px — 4×3 month grid, same
   clickable/inert distinction.
4. `/journal/years/<year>/<month>` (a populated month) — `TodayCompose`
   visible regardless of which month this is; day rows unchanged from
   before this plan (only populated days listed, today highlighted).
5. A populated day's detail page — `TodayCompose` visible above the
   read-only entries; saving there writes to today, not this page's day.
6. Fresh-data sanity check: with a browser profile that has zero journal
   entries (or by temporarily clearing local storage), confirm Year list
   shows only the current year (clickable), and that year's Month list
   shows only the current month clickable, all others inert.

- [ ] **Step 5: Commit**

```bash
git add src/views/journal/DayDetail.jsx
git commit -m "feat(journal): add TodayCompose to Day detail"
```
