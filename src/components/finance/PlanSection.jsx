import { useState } from 'react'
import { useStore } from '../../lib/store'
import { parseAmount, formatCents } from '../../lib/money'

/** Income rows and the savings allocation — the top of the budget math. */
export default function PlanSection({ items, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [planType, setPlanType] = useState('income')

  const plan = items.filter((i) => i.bucket === 'Plan')

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Plan', amount: cents, type: planType })
    setTitle('')
    setAmountStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Plan</h3>
      {plan.map((p) => (
        <div key={p.id} className="fin-row" onClick={() => onEdit(p)} role="button" tabIndex={0}>
          <div className="fin-grow">
            {p.title} <span className="fin-sub">{p.type === 'savings' ? 'savings' : 'income'}</span>
          </div>
          <span className="fin-amount">{formatCents(p.amount)}<span className="fin-sub">/mo</span></span>
        </div>
      ))}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="Salary, savings…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
          <option value="income">Income</option>
          <option value="savings">Savings</option>
        </select>
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
