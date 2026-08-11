import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../../lib/store'
import { monthActuals, categorySeries } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Per-category limit / spent / remaining with mini bars, plus inline add. */
export default function BudgetSection({ items, logs, month, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const updateMoneyLog = useStore((s) => s.updateMoneyLog)
  const deleteMoneyLog = useStore((s) => s.deleteMoneyLog)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [showUncategorized, setShowUncategorized] = useState(false)

  const categories = items.filter((i) => i.bucket === 'Spending')
  const { spendByCategory } = monthActuals(items, logs, month)

  // Spend logs behind the 'uncategorized' bucket: no category chosen at
  // logSpend time, or the category they pointed at was since hard-deleted.
  const known = new Set(items.filter((i) => !i.deletedAt).map((i) => i.id))
  const uncategorizedLogs = logs.filter(
    (l) => !l.deletedAt && l.kind === 'spend' && l.date.startsWith(month) && (!l.itemId || !known.has(l.itemId)),
  )

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
          <div
            key={c.id} className="fin-row" onClick={() => onEdit(c)} role="button" tabIndex={0}
            style={{ '--cat-c': `var(--series-${categorySeries(c)})` }}
          >
            <div className="fin-grow">
              <span className="legend-swatch cat-swatch" />
              {c.title}
              {/* The bar is the category's own color until it goes over the
                  limit, where the warning has to beat the identity. */}
              <div className="fin-minibar"><div className={spent > limit ? 'over' : 'cat'} style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="fin-amount">
              {formatCents(spent)} <span className="fin-sub">/ {limit ? formatCents(limit) : 'set limit'}</span>
            </span>
          </div>
        )
      })}
      {spendByCategory.uncategorized > 0 && (
        <>
          <div className="fin-row" onClick={() => setShowUncategorized((v) => !v)} role="button" tabIndex={0}>
            <div className="fin-grow fin-sub">Uncategorized</div>
            <span className="fin-amount">{formatCents(spendByCategory.uncategorized)}</span>
            {showUncategorized ? <ChevronDown size={16} strokeWidth={1.75} /> : <ChevronRight size={16} strokeWidth={1.75} />}
          </div>
          {showUncategorized && uncategorizedLogs.map((l) => (
            <div key={l.id} className="fin-row">
              <div className="fin-grow fin-sub">{l.note || 'Spend'} · {l.date}</div>
              <span className="fin-amount">{formatCents(l.amount)}</span>
              <select value="" onChange={(e) => e.target.value && updateMoneyLog(l.id, { itemId: e.target.value })}>
                <option value="">Assign category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button className="fin-pay" onClick={() => deleteMoneyLog(l.id)}>Delete</button>
            </div>
          ))}
        </>
      )}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New category" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="Limit" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
