import { useState } from 'react'
import { useStore } from '../../lib/store'
import { subscriptionRollup, monthlyize } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Every subscription with its monthlyized cost, plus the total rollup. */
export default function SubscriptionsSection({ items, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')

  const subs = items.filter((i) => i.bucket === 'Subscriptions')
  const rollup = subscriptionRollup(items)

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, {
      bucket: 'Subscriptions', amount: cents, cadence,
      ...(nextDue && { nextDue }),
    })
    setTitle(''); setAmountStr(''); setNextDue('')
  }

  return (
    <section className="fin-section card">
      <h3>Subscriptions</h3>
      {subs.map((s) => (
        <div key={s.id} className="fin-row" onClick={() => onEdit(s)} role="button" tabIndex={0}>
          <div className="fin-grow">
            {s.title} <span className="fin-sub">{s.cadence === 'yearly' ? 'yearly' : s.cadence === 'biannual' ? 'biannual' : s.cadence === 'weekly' ? 'weekly' : 'monthly'}</span>
          </div>
          <span className="fin-amount">{formatCents(monthlyize(s))}<span className="fin-sub">/mo</span></span>
        </div>
      ))}
      {subs.length > 0 && (
        <div className="fin-row">
          <div className="fin-grow"><strong>Total</strong></div>
          <span className="fin-amount">
            {formatCents(rollup.monthly)}<span className="fin-sub">/mo · {formatCents(rollup.yearly)}/yr</span>
          </span>
        </div>
      )}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New subscription" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="biannual">Biannual</option>
          <option value="yearly">Yearly</option>
          <option value="weekly">Weekly</option>
        </select>
        <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} title="Next renewal (optional)" />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
