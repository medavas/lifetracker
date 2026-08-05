import { useState } from 'react'
import { DAILY_BANDS } from '../data/areas'

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Five calendar weeks of daily practice as presence, not magnitude: every cell
 * is the same height, four fixed slots, lit or dim. Constant height is the
 * point - the block reads as texture, so gaps and runs are visible at a
 * glance. Magnitude lives on DailyStack above.
 */
export default function PracticeGrid({ weeks }) {
  const [tip, setTip] = useState(null)

  const cellLabel = (cell) => {
    const on = DAILY_BANDS.filter((b) => cell.bands[b.id]).map((b) => b.name)
    return on.length ? on.join(', ') : 'nothing logged'
  }

  return (
    <div className="chart-wrap">
      {/* onMouseLeave belongs on the grid, not the cells: leaving one cell and
          entering the next are separate events, so a per-cell handler renders a
          null frame between them, unmounting the caption and jumping the layout
          24px on every move. */}
      <div
        className="practice-grid" role="img" aria-label="Daily practice, last 5 weeks"
        onMouseLeave={() => setTip(null)}
      >
        {DAY_INITIALS.map((d, i) => (
          <div key={i} className="pg-head">{d}</div>
        ))}
        {weeks.map((week) =>
          week.map((cell) => (
            <div
              key={cell.date}
              className={`pg-cell ${cell.future ? 'future' : ''}`}
              onMouseEnter={() => setTip(cell)}
              onTouchStart={() => setTip(cell)}
            >
              {DAILY_BANDS.map((b) => (
                <span
                  key={b.id}
                  className="pg-slot"
                  style={cell.bands[b.id] ? { background: `var(--series-${b.daily.series})` } : undefined}
                />
              ))}
            </div>
          )),
        )}
      </div>

      {/* Always rendered so its reserved min-height holds the layout steady;
          only the text toggles. Mounting it on hover shifted everything below
          it by 24px. */}
      <div className="pg-caption">
        {tip && (
          <>
            {new Date(tip.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {' - '}
            {tip.future ? 'not yet' : cellLabel(tip)}
          </>
        )}
      </div>
    </div>
  )
}
