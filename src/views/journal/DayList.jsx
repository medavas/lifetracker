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

const weekdayOf = (year, month, dayNum) =>
  new Date(Number(year), Number(month) - 1, dayNum).toLocaleDateString(undefined, { weekday: 'long' })

/**
 * Default Journal landing screen: only days with a live entry are listed,
 * oldest at the top, scrolled to the bottom on mount so the most recent
 * entry is immediately visible. A day with no entry does not appear at
 * all. The compose box only appears when this screen represents the
 * current month.
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
        {flags
          .map((hasEntry, i) => ({ hasEntry, dayNum: i + 1 }))
          .filter((d) => d.hasEntry)
          .map(({ dayNum }) => {
            const isToday = isCurrentMonth && dayNum === today
            const rowClass = `item-row day-row has-entry ${isToday ? 'today' : ''}`
            return (
              <Link key={dayNum} to={`/journal/years/${year}/${month}/${dayNum}`} className={rowClass}>
                <span className="item-title">
                  {dayNum}{' \u00b7 '}{weekdayOf(year, month, dayNum)}{isToday ? ' \u00b7 Today' : ''}
                </span>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
