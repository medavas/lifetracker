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
