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
