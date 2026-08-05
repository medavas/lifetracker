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
