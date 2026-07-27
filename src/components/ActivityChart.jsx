import { useState } from 'react'

/**
 * 7-day activity bar chart. Single series (--series-1), so no legend —
 * the title names it. Per-mark hover/tap tooltip + a table view for
 * accessibility, per the dataviz spec.
 */
export default function ActivityChart({ data }) {
  const [tip, setTip] = useState(null)
  const W = 320
  const H = 120
  const PAD = 4
  const max = Math.max(1, ...data.map((d) => d.count))
  const bw = (W - PAD * 2) / data.length

  const dayLabel = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label="Activity, last 7 days">
        {data.map((d, i) => {
          const h = d.count === 0 ? 2 : (d.count / max) * (H - 14)
          const x = PAD + i * bw + 5
          const w = bw - 10
          const y = H - h
          return (
            <g key={d.date}>
              {/* hit target bigger than the mark */}
              <rect
                x={PAD + i * bw} y={0} width={bw} height={H + 18} fill="transparent"
                onMouseEnter={() => setTip({ i, x: ((PAD + i * bw + bw / 2) / W) * 100, d })}
                onMouseLeave={() => setTip(null)}
                onTouchStart={() => setTip({ i, x: ((PAD + i * bw + bw / 2) / W) * 100, d })}
              />
              <rect
                x={x} y={y} width={w} height={h}
                rx={4} ry={4}
                fill={d.count === 0 ? 'var(--surface-3)' : 'var(--series-1)'}
                opacity={tip && tip.i !== i ? 0.55 : 1}
                pointerEvents="none"
              />
              {/* rounded top only: square off the baseline edge */}
              {h > 8 && (
                <rect x={x} y={H - 4} width={w} height={4} fill={d.count === 0 ? 'var(--surface-3)' : 'var(--series-1)'} opacity={tip && tip.i !== i ? 0.55 : 1} pointerEvents="none" />
              )}
              <text
                x={PAD + i * bw + bw / 2} y={H + 14} textAnchor="middle"
                fontSize="10" fill="var(--text-muted)"
              >
                {dayLabel(d.date)}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x}%`, top: 0 }}>
          <b>{tip.d.count} {tip.d.count === 1 ? 'action' : 'actions'}</b>
          {new Date(tip.d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      )}
      <details className="data-toggle">
        <summary>View data</summary>
        <table>
          <thead><tr><th>Day</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
