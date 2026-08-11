import { monthForecast } from '../../lib/finance'
import { formatCents } from '../../lib/money'

const dateLabel = (dateStr) => {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`
}

/**
 * What's scheduled to recur in the browsed month, projected forward from
 * each item's nextDue by cadence. Distinct from BillsSection's "due" list:
 * that one tracks real payments against real-world today, so an autopay
 * bill that never gets a manual "Paid" click just sits there overdue and
 * never appears in a future month. This is a pure forecast — it shows a
 * recurring bill/subscription will land in a given month regardless of
 * whether anyone ever marks it paid.
 */
export default function RecurringForecastSection({ items, month, monthLabel, onEdit }) {
  const forecast = monthForecast(items, month)
  if (forecast.length === 0) return null
  const total = forecast.reduce((s, f) => s + (f.amount ?? 0), 0)

  return (
    <section className="fin-section card">
      <h3>Recurring in {monthLabel}</h3>
      {forecast.map((f) => (
        <div key={`${f.id}-${f.dueDate}`} className="fin-row" onClick={() => onEdit(f)} role="button" tabIndex={0}>
          <div className="fin-grow">
            {f.title} <span className="fin-sub">{f.bucket === 'Subscriptions' ? 'subscription' : 'bill'}</span>
            <div className="fin-due">{dateLabel(f.dueDate)}</div>
          </div>
          <span className="fin-amount">{f.amount != null ? formatCents(f.amount) : ''}</span>
        </div>
      ))}
      <div className="fin-row">
        <div className="fin-grow"><strong>Total</strong></div>
        <span className="fin-amount">{formatCents(total)}</span>
      </div>
    </section>
  )
}
