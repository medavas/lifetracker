# Journal Monthly-First Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat compose-and-scroll Journal page with a year → month → day drill-down, each level its own route, defaulting to the current month scrolled to today. Entries become immutable — no edit, no delete, anywhere in the Journal.

**Architecture:** One new pure module (`journalCalendar.js`) does all date-bucketing over the existing NOTE array — no schema change. Four new thin view components render the four drill-down levels, each with its own route. `Journal.jsx` shrinks from the entire feature to a one-line redirect to the current month.

**Tech Stack:** React 19, react-router-dom (HashRouter), zustand + persist, lucide-react, vitest (node environment).

Spec: [2026-08-05-journal-monthly-nav-design.md](../specs/2026-08-05-journal-monthly-nav-design.md)

## Global Constraints

- **No emoji, dingbats, or arrow glyphs anywhere in `src/`.** Enforced by `src/lib/__tests__/no-emoji.test.js`, which walks every `.js/.jsx/.css/.html` file outside `__tests__`, comments included.
- **Vitest environment is `node`.** No DOM. Components using hooks are never rendered in tests. The one exception in this plan: `Journal.jsx`'s new redirect component has **no hooks at all** (it's a pure function returning `<Navigate>`), so it genuinely can be tested by calling it as a plain function and asserting on the returned element — the same convention `src/components/__tests__/AreaIcon.test.js` already uses.
- **4 primitives, not 12 modules.** No new ITEM field, no new LOG kind, no new AREA kind, no new store slice. `journalCalendar.js` takes the raw `notes` array as a plain argument — it is not a store module.
- **Immutability is final, not partial.** No edit or delete control anywhere in any of the four new views, including for today's own entries. `updateNote`/`deleteNote` in `src/lib/store.js` are not modified or deleted — they simply gain zero callers after this plan, which is fine and out of scope to clean up.
- **`year` is always a 4-digit string; `month` and `day` are 1-indexed, unpadded integers as route-param strings** (`'8'`, not `'08'`). Padding for internal day-key comparison happens only inside `journalCalendar.js`, never in a view.
- **Route params vs. local date parts:** every date comparison in `journalCalendar.js` uses a NOTE's `createdAt` timestamp converted via `new Date(ts).getFullYear()/getMonth()+1/getDate()` — local time, matching the convention `rewards.js`'s `todayKey`/`dayKeyOf` already use elsewhere in this codebase. Never use UTC getters.
- **`pnpm test` and `pnpm lint` must both be green before every commit.**
- Conventional commit messages, lowercase scope, e.g. `feat(journal): ...`.
- Branch: `journal-monthly-nav` (already created; the spec commit `cad3c4e` is on it).

---

### Task 1: `journalCalendar.js` — the pure date-bucketing module

Every other task in this plan depends on this one. Fully unit-testable, no DOM.

**Files:**
- Create: `src/lib/journalCalendar.js`
- Test: `src/lib/__tests__/journalCalendar.test.js`

**Interfaces:**
- Consumes: nothing (pure, takes `notes` as an argument).
- Produces:
  - `yearsWithEntries(notes) -> string[]` — ascending, always includes the current year.
  - `monthEntryFlags(notes, year) -> boolean[12]` — index 0 = January.
  - `daysInMonth(notes, year, month) -> boolean[]` — sized to that month's real day count.
  - `entriesForDay(notes, year, month, day) -> Note[]` — chronological, oldest first.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/journalCalendar.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { yearsWithEntries, monthEntryFlags, daysInMonth, entriesForDay } from '../journalCalendar.js'

const note = (over) => ({
  id: Math.random().toString(), areaId: 'journal', itemId: null, text: 't',
  createdAt: Date.parse('2026-08-04T09:00:00'), updatedAt: 1, deletedAt: null, ...over,
})

describe('yearsWithEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('always includes the current year, even with zero entries', () => {
    expect(yearsWithEntries([])).toEqual(['2026'])
  })

  it('collects distinct years from entries, ascending, deduped', () => {
    const notes = [
      note({ createdAt: Date.parse('2024-03-01T10:00:00') }),
      note({ createdAt: Date.parse('2025-11-20T10:00:00') }),
      note({ createdAt: Date.parse('2024-06-15T10:00:00') }),
    ]
    expect(yearsWithEntries(notes)).toEqual(['2024', '2025', '2026'])
  })

  it('ignores tombstoned notes, per-item notes, and non-journal notes', () => {
    const notes = [
      note({ createdAt: Date.parse('2020-01-01T10:00:00'), deletedAt: 5 }),
      note({ createdAt: Date.parse('2021-01-01T10:00:00'), itemId: 'i1' }),
      note({ createdAt: Date.parse('2022-01-01T10:00:00'), areaId: 'fitness' }),
    ]
    expect(yearsWithEntries(notes)).toEqual(['2026'])
  })
})

describe('monthEntryFlags', () => {
  it('marks only the months with a live entry in that year', () => {
    const notes = [
      note({ createdAt: Date.parse('2026-01-15T10:00:00') }),
      note({ createdAt: Date.parse('2026-08-04T10:00:00') }),
    ]
    const flags = monthEntryFlags(notes, '2026')
    expect(flags).toHaveLength(12)
    expect(flags[0]).toBe(true) // January
    expect(flags[7]).toBe(true) // August
    expect(flags[1]).toBe(false) // February
  })

  it('does not let a December entry leak into the following January', () => {
    const notes = [note({ createdAt: Date.parse('2026-12-31T23:00:00') })]
    expect(monthEntryFlags(notes, '2027')[0]).toBe(false)
    expect(monthEntryFlags(notes, '2026')[11]).toBe(true)
  })

  it('returns all-false for a year with no entries', () => {
    expect(monthEntryFlags([], '2019')).toEqual(new Array(12).fill(false))
  })
})

describe('daysInMonth', () => {
  it('sizes the array to the month\'s real day count', () => {
    expect(daysInMonth([], '2026', 8)).toHaveLength(31) // August
    expect(daysInMonth([], '2026', 4)).toHaveLength(30) // April
    expect(daysInMonth([], '2026', 2)).toHaveLength(28) // February, non-leap
    expect(daysInMonth([], '2028', 2)).toHaveLength(29) // February, leap year
  })

  it('marks the correct day index for an entry', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    const flags = daysInMonth(notes, '2026', 8)
    expect(flags[3]).toBe(true) // the 4th, index 3
    expect(flags[0]).toBe(false)
  })

  it('marks the last day of a leap-year February correctly', () => {
    const notes = [note({ createdAt: Date.parse('2028-02-29T10:00:00') })]
    const flags = daysInMonth(notes, '2028', 2)
    expect(flags).toHaveLength(29)
    expect(flags[28]).toBe(true)
  })

  it('accepts month as a string, matching a route param', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    expect(daysInMonth(notes, '2026', '8')[3]).toBe(true)
  })
})

describe('entriesForDay', () => {
  it('returns only entries on that exact day, chronologically', () => {
    const notes = [
      note({ id: 'b', createdAt: Date.parse('2026-08-04T18:00:00'), text: 'evening' }),
      note({ id: 'a', createdAt: Date.parse('2026-08-04T08:00:00'), text: 'morning' }),
      note({ id: 'c', createdAt: Date.parse('2026-08-05T08:00:00'), text: 'next day' }),
    ]
    const entries = entriesForDay(notes, '2026', 8, 4)
    expect(entries.map((n) => n.text)).toEqual(['morning', 'evening'])
  })

  it('returns an empty array for a day with no entries', () => {
    expect(entriesForDay([], '2026', 8, 4)).toEqual([])
  })

  it('excludes tombstoned and per-item notes on the same day', () => {
    const notes = [
      note({ createdAt: Date.parse('2026-08-04T09:00:00'), deletedAt: 5 }),
      note({ createdAt: Date.parse('2026-08-04T09:00:00'), itemId: 'i1' }),
    ]
    expect(entriesForDay(notes, '2026', 8, 4)).toEqual([])
  })

  it('accepts day and month as strings, matching route params', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    expect(entriesForDay(notes, '2026', '8', '4')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/journalCalendar.test.js`
Expected: FAIL — `Cannot find module '../journalCalendar.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/journalCalendar.js`:

```js
/**
 * Pure date-bucketing over journal NOTEs for the year -> month -> day
 * drill-down. `year` is always a 4-digit string. `month` and `day` are
 * 1-indexed and accepted as either a number or a route-param string --
 * every comparison coerces with Number(). Every date part is read in LOCAL
 * time via new Date(ts).getFullYear()/getMonth()+1/getDate(), matching the
 * convention rewards.js's todayKey/dayKeyOf already use elsewhere.
 */

const isJournalEntry = (n) => n.areaId === 'journal' && !n.itemId && !n.deletedAt

const localParts = (ts) => {
  const d = new Date(ts)
  return { year: String(d.getFullYear()), month: d.getMonth() + 1, day: d.getDate() }
}

const currentYear = () => String(new Date().getFullYear())

/** Every year with a live journal entry, ascending, always including the current year. */
export function yearsWithEntries(notes) {
  const years = new Set([currentYear()])
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    years.add(localParts(n.createdAt).year)
  }
  return [...years].sort()
}

/** Which of the 12 months in `year` have at least one live entry. Index 0 = January. */
export function monthEntryFlags(notes, year) {
  const flags = new Array(12).fill(false)
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    const p = localParts(n.createdAt)
    if (p.year === year) flags[p.month - 1] = true
  }
  return flags
}

/** Which days of `year`/`month` have at least one live entry. Sized to that month's real day count. */
export function daysInMonth(notes, year, month) {
  const count = new Date(Number(year), Number(month), 0).getDate()
  const flags = new Array(count).fill(false)
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    const p = localParts(n.createdAt)
    if (p.year === year && p.month === Number(month)) flags[p.day - 1] = true
  }
  return flags
}

/** Live entries on exactly this day, oldest first -- a diary page reads top to bottom. */
export function entriesForDay(notes, year, month, day) {
  return notes
    .filter((n) => {
      if (!isJournalEntry(n)) return false
      const p = localParts(n.createdAt)
      return p.year === year && p.month === Number(month) && p.day === Number(day)
    })
    .sort((a, b) => a.createdAt - b.createdAt)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/journalCalendar.test.js`
Expected: PASS, 15 tests.

Then run: `pnpm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/journalCalendar.js src/lib/__tests__/journalCalendar.test.js
git commit -m "feat(journal): pure date-bucketing for the year/month/day drill-down"
```

---

### Task 2: `DayDetail.jsx` — the read-only entry list for one day

The simplest of the four views: no compose box, no navigation logic beyond one back button.

**Files:**
- Create: `src/views/journal/DayDetail.jsx`

**Interfaces:**
- Consumes: `entriesForDay` from `src/lib/journalCalendar.js` (Task 1); `useStore` from `src/lib/store.js`.
- Produces: nothing consumed by other tasks — this file is only wired into routing in Task 5.

This component uses `useParams` and `useStore` (both hooks), so per this codebase's convention it gets no unit test. It is verified in Task 5's manual browser check. Do not add a test file for it.

- [ ] **Step 1: Create the component**

Create `src/views/journal/DayDetail.jsx`:

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { entriesForDay } from '../../lib/journalCalendar'

/**
 * Read-only: one day's journal entries. No edit, no delete -- once written,
 * an entry is permanent. Reached only by clicking a marked day in DayList.
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

- [ ] **Step 2: Run the suite**

Run: `pnpm test`
Expected: PASS, whole suite unchanged — this file has no test and nothing imports it yet, so this step is a regression check confirming the new file doesn't break the build (`pnpm lint` picks up syntax errors even on unimported files).

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/views/journal/DayDetail.jsx
git commit -m "feat(journal): read-only day-detail view"
```

---

### Task 3: `DayList.jsx` — the default landing screen

The most complex of the four views: renders every day of the month as rows, carries the compose box for the current month, and auto-scrolls to the bottom on mount.

**Files:**
- Create: `src/views/journal/DayList.jsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `daysInMonth` from `src/lib/journalCalendar.js` (Task 1); `useStore`, `addNote`, `addItem` from `src/lib/store.js`; `suggestAreas` from `src/lib/fuzzy.js`; `AreaIcon` from `src/components/AreaIcon.jsx`.
- Produces: nothing consumed by other tasks — wired into routing in Task 5.

No unit test for this component (hooks), per the same convention as Task 2. Verified in Task 5's manual browser check.

- [ ] **Step 1: Create the component**

Create `src/views/journal/DayList.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { suggestAreas } from '../../lib/fuzzy'
import { daysInMonth } from '../../lib/journalCalendar'
import AreaIcon from '../../components/AreaIcon'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Default Journal landing screen: every day of one month, oldest at the
 * top, scrolled to the bottom on mount so today is immediately visible.
 * Only days with a live entry are marked and clickable. The compose box
 * only appears when this screen represents the current month.
 */
export default function DayList() {
  const { year, month } = useParams()
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))
  const addNote = useStore((s) => s.addNote)
  const addItem = useStore((s) => s.addItem)

  const [draft, setDraft] = useState('')
  const [alsoFile, setAlsoFile] = useState([])

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

  const related = useMemo(() => suggestAreas(draft).filter((a) => a.kind !== 'journal'), [draft])

  const save = () => {
    if (!draft.trim()) return
    addNote('journal', draft)
    for (const areaId of alsoFile) addItem(areaId, draft.split('\n')[0].slice(0, 120))
    setDraft('')
    setAlsoFile([])
  }

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate(`/journal/years/${year}`)}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
        <h1>{MONTH_NAMES[Number(month) - 1]} {year}</h1>
      </div>

      {isCurrentMonth && (
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
      )}

      <div className="item-list" style={{ marginTop: 16 }}>
        {flags.map((hasEntry, i) => {
          const dayNum = i + 1
          const isToday = isCurrentMonth && dayNum === today
          const rowClass = `item-row day-row ${hasEntry ? 'has-entry' : ''} ${isToday ? 'today' : ''}`
          const label = <span className="item-title">{dayNum}{isToday ? ' · Today' : ''}</span>
          return hasEntry ? (
            <Link key={dayNum} to={`/journal/years/${year}/${month}/${dayNum}`} className={rowClass}>
              {label}
            </Link>
          ) : (
            <div key={dayNum} className={rowClass}>{label}</div>
          )
        })}
      </div>
    </div>
  )
}
```

Note the middle-dot separator is written as the escape `·`, not a literal `·` character, so `no-emoji.test.js` never has to be re-examined for it — plain ASCII source, no risk either way.

- [ ] **Step 2: Add the CSS**

Append to `src/App.css`:

```css
a.item-row { text-decoration: none; color: inherit; }
.day-row:not(.has-entry) { cursor: default; }
.day-row:not(.has-entry) .item-title { color: var(--text-muted); }
.day-row.has-entry { cursor: pointer; }
.day-row.today .item-title { font-weight: 600; }
```

- [ ] **Step 3: Run the suite**

Run: `pnpm test`
Expected: PASS, whole suite unchanged.

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/views/journal/DayList.jsx src/App.css
git commit -m "feat(journal): default day-list view with the compose box"
```

---

### Task 4: `MonthList.jsx` and `YearList.jsx` — the two button-list levels

Both screens are the same shape: a fixed or computed set of buttons, each navigating one level down. Small enough to build together.

**Files:**
- Create: `src/views/journal/MonthList.jsx`
- Create: `src/views/journal/YearList.jsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `monthEntryFlags`, `yearsWithEntries` from `src/lib/journalCalendar.js` (Task 1); `useStore` from `src/lib/store.js`.
- Produces: nothing consumed by other tasks — wired into routing in Task 5.

No unit tests for these components (hooks), per the same convention as Tasks 2 and 3. Verified in Task 5's manual browser check.

- [ ] **Step 1: Create `MonthList.jsx`**

Create `src/views/journal/MonthList.jsx`:

```jsx
import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { monthEntryFlags } from '../../lib/journalCalendar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** All 12 months of one year, calendar-like -- every month renders, entries mark which have activity. */
export default function MonthList() {
  const { year } = useParams()
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))
  const flags = useMemo(() => monthEntryFlags(notes, year), [notes, year])

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate('/journal/years')}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
        <h1>{year}</h1>
      </div>
      <div className="button-grid">
        {MONTH_NAMES.map((name, i) => (
          <button
            key={name}
            className={`bucket-tab ${flags[i] ? 'on' : ''}`}
            onClick={() => navigate(`/journal/years/${year}/${i + 1}`)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `YearList.jsx`**

Create `src/views/journal/YearList.jsx`:

```jsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../lib/store'
import { yearsWithEntries } from '../../lib/journalCalendar'

/** Top of the drill-down: every year with a live entry, plus always the current year. */
export default function YearList() {
  const navigate = useNavigate()
  const notes = useStore(useShallow((s) => s.notes))
  const years = useMemo(() => yearsWithEntries(notes), [notes])

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className="page-head"><h1>Journal</h1></div>
      <div className="button-grid">
        {years.map((y) => (
          <button key={y} className="bucket-tab" onClick={() => navigate(`/journal/years/${y}`)}>
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the CSS**

Append to `src/App.css`:

```css
.button-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
```

- [ ] **Step 4: Run the suite**

Run: `pnpm test`
Expected: PASS, whole suite unchanged.

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/views/journal/MonthList.jsx src/views/journal/YearList.jsx src/App.css
git commit -m "feat(journal): year-list and month-list drill-down levels"
```

---

### Task 5: Wire it together — the redirect and the routes

The final task: `Journal.jsx` shrinks to a redirect (the one component in this feature genuinely testable, since it has no hooks), and `App.jsx` gains the four new routes. This is also where the whole feature becomes reachable and gets its end-to-end manual verification.

**Files:**
- Modify: `src/views/Journal.jsx` (full replacement)
- Modify: `src/App.jsx`
- Test: `src/views/__tests__/Journal.test.js`

**Interfaces:**
- Consumes: `YearList`, `MonthList`, `DayList`, `DayDetail` from Tasks 2-4.
- Produces: nothing — this is the last task in the plan.

- [ ] **Step 1: Write the failing test**

Create `src/views/__tests__/Journal.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Navigate } from 'react-router-dom'
import Journal from '../Journal'

describe('Journal redirect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('redirects to the current month\'s day list', () => {
    const el = Journal()
    expect(el.type).toBe(Navigate)
    expect(el.props.to).toBe('/journal/years/2026/8')
    expect(el.props.replace).toBe(true)
  })

  it('tracks a December boundary correctly', () => {
    vi.setSystemTime(new Date('2026-12-25T12:00:00'))
    const el = Journal()
    expect(el.props.to).toBe('/journal/years/2026/12')
  })

  it('tracks a January boundary into the new year correctly', () => {
    vi.setSystemTime(new Date('2027-01-03T12:00:00'))
    const el = Journal()
    expect(el.props.to).toBe('/journal/years/2027/1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/views/__tests__/Journal.test.js`
Expected: FAIL — the old `Journal.jsx` default-exports a component with hooks and no `<Navigate>`, so `Journal()` called as a plain function throws (hooks can't run outside a render) or returns the wrong element shape.

- [ ] **Step 3: Replace `Journal.jsx`**

Replace the entire contents of `src/views/Journal.jsx` with:

```jsx
import { Navigate } from 'react-router-dom'

/**
 * Default Journal entry point: redirect to the current month's day list.
 * No hooks -- this makes it the one Journal component genuinely testable
 * by calling it as a plain function, per the AreaIcon.test.js convention.
 */
export default function Journal() {
  const now = new Date()
  return <Navigate to={`/journal/years/${now.getFullYear()}/${now.getMonth() + 1}`} replace />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/views/__tests__/Journal.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the routes in `App.jsx`**

In `src/App.jsx`, add the four new imports alongside the existing view imports:

```js
import YearList from './views/journal/YearList'
import MonthList from './views/journal/MonthList'
import DayList from './views/journal/DayList'
import DayDetail from './views/journal/DayDetail'
```

Add the four new routes immediately after the existing `/journal` route:

```jsx
          <Route path="/journal" element={<Journal />} />
          <Route path="/journal/years" element={<YearList />} />
          <Route path="/journal/years/:year" element={<MonthList />} />
          <Route path="/journal/years/:year/:month" element={<DayList />} />
          <Route path="/journal/years/:year/:month/:day" element={<DayDetail />} />
```

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: PASS, entire suite including the new `Journal.test.js`.

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 7: Manual browser verification**

Run: `pnpm dev`, then in the browser:

1. Go to Journal (bottom nav). It redirects to the current month's day list, and the page is scrolled to the bottom — today's row is in view without scrolling.
2. Write an entry in the compose box. Today's row becomes marked. The "also file as an item" chips still appear when the text matches another area's keywords, exactly as before this branch.
3. Click on today's now-marked row. It opens the day-detail view: your entry's timestamp and text, no edit button, no delete button, nothing clickable on the entry itself.
4. Click Back. You're on the day list again, at the same month.
5. Click Back again. You're on the month list for the current year — all 12 months shown, today's month highlighted as having activity, every other month plain.
6. Click a different month with no entries. Its day list renders with every day present, none clickable, and no compose box (since it isn't the current month).
7. Click Back twice to return to the month list, then click Back once more. You're on the year list — at minimum the current year appears, even if this is a fresh install.
8. If you have historical entries from a prior month/year, confirm you can drill all the way down to one of those days and see it correctly, and that it looks identical in kind to today's view (read-only, chronological within the day) but has no compose box (since it isn't the current month).
9. Reload the page directly on a deep URL, e.g. navigate the browser to `#/journal/years/2026/8/4` directly (typed or pasted, not clicked from within the app). It renders correctly without needing to have drilled down through the hierarchy first.

- [ ] **Step 8: Commit**

```bash
git add src/views/Journal.jsx src/App.jsx src/views/__tests__/Journal.test.js
git commit -m "feat(journal): wire the year/month/day drill-down into routing"
```

---

## Self-review notes

**Spec coverage.** Four routes matching the spec's table exactly (Task 5) · redirect from `/journal` computed from `new Date()` (Task 5, with real test coverage — the one component in this feature that could get it) · day list as a scrollable list, not a calendar grid, auto-scrolled to the bottom (Task 3) · month list always renders all 12 months (Task 4) · year list always includes the current year (Task 1's `yearsWithEntries`, tested) · immutability — no edit/delete control anywhere in any of the four new views (Tasks 2-4, verified by their absence from every file's code) · compose box only on the current month's day list (Task 3) · fuzzy "also file as an item" chips carried forward unchanged (Task 3, byte-identical logic to the old `Journal.jsx`) · `entriesForDay` chronological, oldest-first (Task 1, tested) · route-param format (unpadded) vs. internal day-key padding handled entirely inside `journalCalendar.js` (Task 1) · every listed test in the spec's Testing section (Task 1's boundary/leap-year/tombstone cases; Task 5's manual check covering the full drill-down, an empty month, deep-linking, and a fresh-install year list).

**No placeholders.** Every step has literal code.

**Type/name consistency checked across tasks:** `yearsWithEntries`, `monthEntryFlags`, `daysInMonth`, `entriesForDay` (Task 1) are imported and called with the exact same names and argument order in Tasks 2-4. Route paths (`/journal/years`, `/journal/years/:year`, `/journal/years/:year/:month`, `/journal/years/:year/:month/:day`) are identical between each view's `navigate()`/`Link` calls (Tasks 2-4) and the route declarations (Task 5) — verified by re-reading each `navigate(...)`/`<Link to=...>` call against the Task 5 route list before finalizing this plan.

**One deliberate scope decision, stated rather than hidden:** `updateNote`/`deleteNote` in `store.js` are left in place with zero remaining callers after this plan. Deleting unused store actions is a separate, smaller cleanup and out of scope for a navigation redesign — consistent with the spec's own "Explicitly out of scope" section.
