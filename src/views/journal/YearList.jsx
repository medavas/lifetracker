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
