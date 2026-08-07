import { useState } from 'react'
import { useStore } from '../../lib/store'
import { upcomingBills } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'
import { todayKey } from '../../lib/rewards'

const dueLabel = (dateStr, overdue) => {
  const [, m, d] = dateStr.split('-').map(Number)
  const label = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`
  return overdue ? `${label} - overdue` : label
}

/** Everything due in the next 14 days (or overdue), with one-tap mark paid. */
export default function BillsSection({ items, onEdit }) {
  const payBill = useStore((s) => s.payBill)
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')
  const [payFor, setPayFor] = useState(null) // billId awaiting a manual amount
  const [payStr, setPayStr] = useState('')

  const due = upcomingBills(items, todayKey())
  const allBills = items.filter((i) => i.bucket === 'Bills')

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null || !nextDue) return
    addItem('finance', title, { bucket: 'Bills', amount: cents, cadence, nextDue })
    setTitle(''); setAmountStr(''); setNextDue('')
  }

  const pay = (bill) => {
    if (bill.amount != null) return payBill(bill.id)
    if (payFor !== bill.id) { setPayFor(bill.id); setPayStr(''); return }
    const cents = parseAmount(payStr)
    if (cents == null) return
    payBill(bill.id, cents)
    setPayFor(null)
  }

  return (
    <section className="fin-section card">
      <h3>Bills due</h3>
      {due.length === 0 && <div className="fin-sub">Nothing due in the next two weeks.</div>}
      {due.map((b) => (
        <div key={b.id} className="fin-row">
          <div className="fin-grow" onClick={() => onEdit(b)} role="button" tabIndex={0}>
            {b.title}
            <div className={`fin-due ${b.overdue ? 'overdue' : ''}`}>{dueLabel(b.nextDue, b.overdue)}</div>
          </div>
          <span className="fin-amount">{b.amount != null ? formatCents(b.amount) : ''}</span>
          {payFor === b.id && (
            <input
              className="fin-amt" inputMode="decimal" placeholder="0.00" autoFocus
              value={payStr} onChange={(e) => setPayStr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pay(b)}
            />
          )}
          <button className="fin-pay" onClick={() => pay(b)}>Paid</button>
        </div>
      ))}
      {allBills.length === 0 && due.length === 0 && <div className="fin-sub">Add your first bill below.</div>}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New bill" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="weekly">Weekly</option>
        </select>
        <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
