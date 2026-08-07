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
