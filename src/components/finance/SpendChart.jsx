import { useState } from 'react'
import { spendPeriods, spendBands, UNCATEGORIZED } from '../../lib/finance'
import { stackGeometry } from '../../lib/chart'
import { formatCents } from '../../lib/money'

const W = 320
const H = 128

/** Uncategorized has no category to take a color from, so it stays neutral. */
const fillOf = (series) => (series ? `var(--series-${series})` : 'var(--surface-3)')

/**
 * Spending over the month, stacked by category — the same chart as
 * DailyStack (shared stackGeometry, shared legend/tooltip grammar), with a
 * day/week toggle because a month of daily bars answers "what did today
 * cost" and weekly bars answer "is this month drifting".
 *
 * Color is the only label a segment carries, so it comes from the category
 * item itself and the legend names every band that is in the picture.
 */
export default function SpendChart({ items, logs, month }) {
  const [grain, setGrain] = useState('day')
  const [tip, setTip] = useState(null)

  const periods = spendPeriods(items, logs, month, grain)
  const bands = spendBands(items, logs, month)
  const cols = stackGeometry(periods, bands, { width: W, height: H, gap: grain === 'week' ? 10 : 2, seriesOf: (b) => b.series })
  const total = periods.reduce((s, p) => s + p.total, 0)
  const peak = Math.max(0, ...periods.map((p) => p.total))

  // 31 columns cannot all be labelled; every fifth day plus the 1st reads as
  // a scale without turning the axis into a smear.
  const label = (p) =>
    grain === 'week' ? `${p.start}–${p.end}` : p.start === 1 || p.start % 5 === 0 ? p.start : ''

  const tipTitle = (p) =>
    grain === 'week' ? `Days ${p.start}–${p.end}` : `Day ${p.start}`

  return (
    <section className="fin-section card">
      <div className="fin-charthead">
        <h3>Spending by category</h3>
        <div className="link-chips">
          {['day', 'week'].map((g) => (
            <button key={g} className={`chip ${grain === g ? 'on' : ''}`} onClick={() => setGrain(g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className="fin-sub" style={{ marginBottom: 6 }}>
        {formatCents(total)} this month
        {peak > 0 ? ` · biggest ${grain} ${formatCents(peak)}` : ''}
      </div>

      <div className="chart-wrap">
        {/* onMouseLeave sits on the svg, not the columns: leaving one column
            and entering the next are separate events, so a per-column
            handler renders a null frame between them and the tip blinks. */}
        <svg
          viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img"
          aria-label={`Spending by category, per ${grain}`}
          onMouseLeave={() => setTip(null)}
        >
          {cols.map((c, i) => (
            <g key={c.date}>
              <rect
                x={c.colX} y={0} width={c.colW} height={H + 18} fill="transparent"
                onMouseEnter={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100 })}
                onTouchStart={() => setTip({ i, x: ((c.colX + c.colW / 2) / W) * 100 })}
              />
              {c.total === 0 && (
                <rect x={c.x} y={H - 2} width={c.w} height={2} rx={1} fill="var(--surface-3)" pointerEvents="none" />
              )}
              {c.segments.map((s) => (
                <rect
                  key={s.areaId}
                  x={c.x} y={s.y} width={c.w} height={s.h}
                  fill={fillOf(s.series)}
                  opacity={tip && tip.i !== i ? 0.55 : 1}
                  pointerEvents="none"
                />
              ))}
              <text
                x={c.colX + c.colW / 2} y={H + 14} textAnchor="middle"
                fontSize="10" fill="var(--text-muted)"
              >
                {label(periods[i])}
              </text>
            </g>
          ))}
        </svg>

        {tip && (
          <div className="chart-tip" style={{ left: `${tip.x}%`, top: 0 }}>
            <b>{tipTitle(periods[tip.i])} · {formatCents(periods[tip.i].total)}</b>
            {bands
              .filter((b) => (periods[tip.i].bands[b.id] ?? 0) > 0)
              .map((b) => (
                <div key={b.id} className="tip-row">
                  <span className="tip-dot" style={{ background: fillOf(b.series) }} />
                  {b.name}
                  <b>{formatCents(periods[tip.i].bands[b.id])}</b>
                </div>
              ))}
          </div>
        )}

        <div className="chart-legend">
          {bands.map((b) => (
            <span key={b.id} className={`legend-item ${b.id === UNCATEGORIZED ? 'fin-sub' : ''}`}>
              <span className="legend-swatch" style={{ background: fillOf(b.series) }} />
              {b.name}
            </span>
          ))}
          {bands.length === 0 && <span className="fin-sub">No spending logged yet.</span>}
        </div>
      </div>
    </section>
  )
}
