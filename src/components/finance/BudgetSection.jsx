import { useState } from 'react'
import { useStore } from '../../lib/store'
import { monthActuals } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Per-category limit / spent / remaining with mini bars, plus inline add. */
export default function BudgetSection({ items, logs, month, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const categories = items.filter((i) => i.bucket === 'Spending')
  const { spendByCategory } = monthActuals(items, logs, month)

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Spending', amount: cents })
    setTitle('')
    setAmountStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Budget</h3>
      {categories.map((c) => {
        const spent = spendByCategory[c.id] ?? 0
        const limit = c.amount ?? 0
        const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
        return (
          <div key={c.id} className="fin-row" onClick={() => onEdit(c)} role="button" tabIndex={0}>
            <div className="fin-grow">
              {c.title}
              <div className="fin-minibar"><div className={spent > limit ? 'over' : ''} style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="fin-amount">
              {formatCents(spent)} <span className="fin-sub">/ {limit ? formatCents(limit) : 'set limit'}</span>
            </span>
          </div>
        )
      })}
      {spendByCategory.uncategorized > 0 && (
        <div className="fin-row">
          <div className="fin-grow fin-sub">Uncategorized</div>
          <span className="fin-amount">{formatCents(spendByCategory.uncategorized)}</span>
        </div>
      )}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New category" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="Limit" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
