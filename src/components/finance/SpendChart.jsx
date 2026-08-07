import { dailySpend, spendBars } from '../../lib/finance'
import { formatCents } from '../../lib/money'

const W = 320
const H = 96

/**
 * Daily discretionary spend for the month. Geometry lives in
 * lib/finance.js (stackGeometry pattern); series-4 matches finance's
 * amber trim family without touching the validated palette.
 */
export default function SpendChart({ logs, month }) {
  const days = dailySpend(logs, month)
  const bars = spendBars(days, { width: W, height: H })
  const max = Math.max(...days)
  const total = days.reduce((s, v) => s + v, 0)

  return (
    <section className="fin-section card">
      <h3>Daily spending</h3>
      <div className="fin-sub" style={{ marginBottom: 6 }}>
        {formatCents(total)} this month{max > 0 ? ` · biggest day ${formatCents(max)}` : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Daily spending chart">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.w} height={b.h} rx="1" fill="var(--series-4)">
            <title>{`Day ${b.day}: ${formatCents(b.total)}`}</title>
          </rect>
        ))}
      </svg>
    </section>
  )
}
