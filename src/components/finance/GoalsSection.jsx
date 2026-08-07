import { useState } from 'react'
import { useStore } from '../../lib/store'
import { goalProgress } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Savings goals: progress computed from contribution logs, never stored. */
export default function GoalsSection({ items, logs, onEdit }) {
  const contribute = useStore((s) => s.contribute)
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [targetStr, setTargetStr] = useState('')
  const [contribFor, setContribFor] = useState(null)
  const [contribStr, setContribStr] = useState('')

  const goals = items.filter((i) => i.bucket === 'Goals')

  const add = () => {
    const cents = parseAmount(targetStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Goals', amount: cents })
    setTitle(''); setTargetStr('')
  }

  const addContribution = (goal) => {
    const cents = parseAmount(contribStr)
    if (cents == null) return
    contribute(goal.id, cents)
    setContribFor(null); setContribStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Savings goals</h3>
      {goals.map((g) => {
        const saved = goalProgress(logs, g.id)
        const target = g.amount ?? 0
        const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0
        return (
          <div key={g.id} className="fin-row">
            <div className="fin-grow" onClick={() => onEdit(g)} role="button" tabIndex={0}>
              {g.title}
              <div className="fin-minibar"><div style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="fin-amount">
              {formatCents(saved)} <span className="fin-sub">/ {target ? formatCents(target) : 'set target'}</span>
            </span>
            {contribFor === g.id ? (
              <input
                className="fin-amt" inputMode="decimal" placeholder="0.00" autoFocus
                value={contribStr} onChange={(e) => setContribStr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContribution(g)}
              />
            ) : (
              <button className="fin-pay" onClick={() => { setContribFor(g.id); setContribStr('') }}>Add</button>
            )}
          </div>
        )
      })}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New goal" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="Target" value={targetStr} onChange={(e) => setTargetStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
