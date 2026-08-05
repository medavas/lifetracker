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
      <div className="practice-grid" role="img" aria-label="Daily practice, last 5 weeks">
        {DAY_INITIALS.map((d, i) => (
          <div key={i} className="pg-head">{d}</div>
        ))}
        {weeks.map((week) =>
          week.map((cell) => (
            <div
              key={cell.date}
              className={`pg-cell ${cell.future ? 'future' : ''}`}
              onMouseEnter={() => setTip(cell)}
              onMouseLeave={() => setTip(null)}
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

      {tip && (
        <div className="pg-caption">
          {new Date(tip.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' - '}
          {tip.future ? 'not yet' : cellLabel(tip)}
        </div>
      )}

      <details className="data-toggle">
        <summary>View data</summary>
        <table>
          <thead>
            <tr><th>Day</th>{DAILY_BANDS.map((b) => <th key={b.id}>{b.name}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.flat().filter((c) => !c.future).map((c) => (
              <tr key={c.date}>
                <td>{c.date}</td>
                {DAILY_BANDS.map((b) => <td key={b.id}>{c.bands[b.id] ? 'yes' : 'no'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
