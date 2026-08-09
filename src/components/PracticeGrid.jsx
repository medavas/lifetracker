// Explicit React import so this file can be render-tested: vitest transforms
// JSX with the classic runtime (its config carries no react plugin), unlike the
// Vite build. Journal.jsx and AreaIcon.jsx carry the same import for the same
// reason. Fixing it properly is one line of esbuild config in vitest.config.js.
import React, { Fragment, useState } from 'react'
import { DAILY_BANDS } from '../data/areas'

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const monthOf = (dateKey) =>
  new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' })

/**
 * A rolling window of daily practice as presence, not magnitude: every cell is
 * the same size, four fixed slots, lit or dim. Constant size is the point - the
 * block reads as texture, so gaps and runs are visible at a glance. Magnitude
 * lives on DailyStack above.
 *
 * Laid out weeks-as-COLUMNS, days-as-rows, transposed from the calendar
 * orientation you would reach for first. That is what lets the window be a
 * quarter instead of a month: 13 weeks stacked as rows is a 400px tower, while
 * 13 weeks as columns stays exactly seven cells tall no matter how far back the
 * window reaches. Only the width grows, and the card absorbs that.
 */
export default function PracticeGrid({ weeks }) {
  const [tip, setTip] = useState(null)

  const cellLabel = (cell) => {
    const on = DAILY_BANDS.filter((b) => cell.bands[b.id]).map((b) => b.name)
    return on.length ? on.join(', ') : 'nothing logged'
  }

  // A month name sits above the first column that opens it; every other header
  // cell is an empty spacer so the row stays in lockstep with the grid below.
  // Over a 13-week window these are the only orientation the user gets.
  const months = weeks.map((week, w) =>
    w === 0 || monthOf(week[0].date) !== monthOf(weeks[w - 1][0].date) ? monthOf(week[0].date) : '',
  )

  return (
    <div className="chart-wrap">
      {/* onMouseLeave belongs on the grid, not the cells: leaving one cell and
          entering the next are separate events, so a per-cell handler renders a
          null frame between them, unmounting the caption and jumping the layout
          24px on every move. */}
      <div
        className="practice-grid"
        style={{ '--pg-weeks': weeks.length }}
        role="img"
        aria-label={`Daily practice, last ${weeks.length} weeks`}
        onMouseLeave={() => setTip(null)}
      >
        <div className="pg-corner" />
        {months.map((month, w) => (
          <div key={w} className="pg-month">{month}</div>
        ))}

        {DAY_INITIALS.map((initial, d) => (
          <Fragment key={d}>
            <div className="pg-head">{initial}</div>
            {weeks.map((week) => {
              const cell = week[d]
              return (
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
              )
            })}
          </Fragment>
        ))}
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
