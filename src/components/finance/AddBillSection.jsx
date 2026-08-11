import { useState } from 'react'
import { useStore } from '../../lib/store'
import { parseAmount } from '../../lib/money'

/**
 * The bill composer, kept apart from "Bills due" on purpose: that section
 * sits near the top because it is the thing you act on, while every other
 * add control on this page lives down here. Four fields is also the widest
 * composer on the dashboard, and it read as clutter above the list it fills.
 */
export default function AddBillSection() {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null || !nextDue) return
    addItem('finance', title, { bucket: 'Bills', amount: cents, cadence, nextDue })
    setTitle(''); setAmountStr(''); setNextDue('')
  }

  return (
    <section className="fin-section card">
      <h3>Add a bill</h3>
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New bill" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="biannual">Biannual</option>
          <option value="yearly">Yearly</option>
          <option value="weekly">Weekly</option>
        </select>
        <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
