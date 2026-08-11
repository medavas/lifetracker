import { useState } from 'react'
import { DAILY_BANDS } from '../data/areas'
import { stackGeometry } from '../lib/chart'
import AreaIcon from './AreaIcon'

const W = 320
const H = 120

/**
 * Daily practice, stacked by area. Four series means the title can no longer
 * name the data, so this chart carries a legend; identity there is icon and
 * name first, with color as reinforcement.
 *
 * Geometry lives in lib/chart.js so it can be unit-tested without a DOM.
 */
export default function DailyStack({ data }) {
  const [tip, setTip] = useState(null)
  const cols = stackGeometry(data, DAILY_BANDS, { width: W, height: H })

  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })

  return (
    <div className="chart-wrap">
      {/* onMouseLeave belongs on the svg, not the per-column hit targets: leaving
          one column and entering the next are separate events, so a per-column
          handler renders a null frame between them and the tooltip blinks. */}
      <svg
        viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" role="img"
        aria-label="Daily practice, last 7 days by area"
        onMouseLeave={() => setTip(null)}
      >
        {cols.map((c, i) => (
          <g key={c.date}>
            <rect
              x={c.colX} y={0} width={c.colW} height={H + 18} fill="transparent"
              onMouseEnter={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100, c })}
              onTouchStart={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100, c })}
            />
            {c.total === 0 && (
              <rect x={c.x} y={H - 2} width={c.w} height={2} rx={1} fill="var(--surface-3)" pointerEvents="none" />
            )}
            {c.segments.map((s) => (
              <rect
                key={s.areaId}
                x={c.x} y={s.y} width={c.w} height={s.h}
                fill={`var(--series-${s.series})`}
                opacity={tip && tip.i !== i ? 0.55 : 1}
                pointerEvents="none"
              />
            ))}
            <text
              x={c.colX + c.colW / 2} y={H + 14} textAnchor="middle"
              fontSize="10" fill="var(--text-muted)"
            >
              {dayLabel(c.date)}
            </text>
          </g>
        ))}
      </svg>

      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x}%`, top: 0 }}>
          <b>{new Date(tip.c.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>
          {DAILY_BANDS.map((b) => (
            <div key={b.id} className="tip-row">
              <span className="tip-dot" style={{ background: `var(--series-${b.daily.series})` }} />
              {b.name}
              <b>{data[tip.i].bands[b.id]}</b>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {DAILY_BANDS.map((b) => (
          <span key={b.id} className="legend-item">
            <span className="legend-swatch" style={{ background: `var(--series-${b.daily.series})` }} />
            <AreaIcon name={b.icon} size={13} />
            {b.name}
          </span>
        ))}
      </div>
    </div>
  )
}
