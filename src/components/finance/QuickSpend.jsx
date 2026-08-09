import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import { parseAmount } from '../../lib/money'
import { categorySeries } from '../../lib/finance'

/**
 * The everyday surface: amount + category chip + optional memo. The chip
 * stays selected after a submit — consecutive spends are usually the same
 * category, and a log that lands uncategorized is one the chart can't
 * explain later.
 */
export default function QuickSpend({ categories, isCurrentMonth }) {
  const logSpend = useStore((s) => s.logSpend)
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [catId, setCatId] = useState(null)

  const submit = () => {
    const cents = parseAmount(amountStr)
    if (cents == null) return
    logSpend(catId, cents, note)
    setAmountStr('')
    setNote('')
  }

  return (
    <section className="fin-section card">
      <h3>Log spending</h3>
      {isCurrentMonth === false ? (
        <div className="fin-sub">Switch to the current month to log spending.</div>
      ) : (
        <>
          <div className="fin-addrow">
            <input
              className="fin-amt" inputMode="decimal" placeholder="0.00"
              value={amountStr} onChange={(e) => setAmountStr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <input
              className="fin-title" placeholder="What for? (optional)"
              value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className="fin-add" onClick={submit} aria-label="Log spend"><Plus size={16} /></button>
          </div>
          <div className="link-chips" style={{ marginTop: 8 }}>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip chip-swatch ${catId === c.id ? 'on' : ''}`}
                style={{ '--chip-c': `var(--series-${categorySeries(c)})` }}
                aria-pressed={catId === c.id}
                onClick={() => setCatId(catId === c.id ? null : c.id)}
              >
                <span className="legend-swatch" />
                {c.title}
              </button>
            ))}
            {categories.length === 0 && (
              <span className="fin-sub">Add a budget category below to tag spending.</span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
