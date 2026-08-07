import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import { parseAmount } from '../../lib/money'

/** The everyday surface: amount + category chip + optional memo. */
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
                className={`chip ${catId === c.id ? 'on' : ''}`}
                onClick={() => setCatId(catId === c.id ? null : c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
