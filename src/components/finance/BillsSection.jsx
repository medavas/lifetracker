import { useState } from 'react'
import { useStore } from '../../lib/store'
import { upcomingBills, monthKey } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'
import { todayKey } from '../../lib/rewards'

const dueLabel = (dateStr, overdue) => {
  const [, m, d] = dateStr.split('-').map(Number)
  const label = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`
  return overdue ? `${label} - overdue` : label
}

/** Everything due in the next 14 days (or overdue), with one-tap mark paid. */
export default function BillsSection({ items, logs, onEdit }) {
  const payBill = useStore((s) => s.payBill)
  const deleteMoneyLog = useStore((s) => s.deleteMoneyLog)
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')
  const [payFor, setPayFor] = useState(null) // billId awaiting a manual amount
  const [payStr, setPayStr] = useState('')

  const today = todayKey()
  const due = upcomingBills(items, today)
  const allBills = items.filter((i) => i.bucket === 'Bills')
  // Bills-bucket items not already surfaced in the due-soon-or-overdue list
  // above (no nextDue, or a nextDue further out than the 14-day horizon) —
  // without this they never appear anywhere in the UI.
  const otherBills = allBills.filter((b) => !due.some((d) => d.id === b.id))

  // Bills-due is intentionally scoped to real-world "today", not the
  // dashboard's browsed month — a bill due next week is due next week
  // regardless of which budget-month the header happens to show. So
  // payBill here always logging today's real date is correct, not a
  // month-mismatch bug (see QuickSpend for the case that IS a bug).
  const billItemIds = new Set(
    items.filter((i) => i.bucket === 'Bills' || i.bucket === 'Subscriptions').map((i) => i.id),
  )
  const curMonth = monthKey(today)
  const paidThisMonth = (logs ?? [])
    .filter((l) => !l.deletedAt && l.kind === 'bill-pay' && billItemIds.has(l.itemId) && l.date.startsWith(curMonth))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  // Only the most recent live bill-pay log per item is eligible for Undo.
  // deleteMoneyLog restores nextDue from the log's own prevDue, which
  // assumes LIFO — undoing an older payment out of order could corrupt
  // the bill's due date. Gating Undo to "latest per item" here makes that
  // case unreachable through the UI without touching store.js.
  const latestPaidByItem = {}
  for (const l of paidThisMonth) {
    if (!latestPaidByItem[l.itemId]) latestPaidByItem[l.itemId] = l.id
  }

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

      {otherBills.length > 0 && (
        <>
          <h3>All bills</h3>
          {otherBills.map((b) => (
            <div key={b.id} className="fin-row">
              <div className="fin-grow" onClick={() => onEdit(b)} role="button" tabIndex={0}>
                {b.title}
                <div className="fin-due">{b.nextDue ? dueLabel(b.nextDue, false) : 'No due date set'}</div>
              </div>
              <span className="fin-amount">{b.amount != null ? formatCents(b.amount) : ''}</span>
            </div>
          ))}
        </>
      )}

      {paidThisMonth.length > 0 && (
        <>
          <h3>Paid this month</h3>
          {paidThisMonth.map((l) => {
            const item = items.find((i) => i.id === l.itemId)
            return (
              <div key={l.id} className="fin-row">
                <div className="fin-grow">
                  {item?.title ?? 'Unknown'}
                  <div className="fin-due">{dueLabel(l.date, false)}</div>
                </div>
                <span className="fin-amount">{formatCents(l.amount)}</span>
                {latestPaidByItem[l.itemId] === l.id && (
                  <button className="fin-pay" onClick={() => deleteMoneyLog(l.id)}>Undo</button>
                )}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
