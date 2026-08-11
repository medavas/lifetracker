import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { areaById } from '../data/areas'
import { monthKey, shiftMonth, budgetSummary, daysInMonth } from '../lib/finance'
import { formatCents } from '../lib/money'
import { todayKey } from '../lib/rewards'
import AreaIcon from '../components/AreaIcon'
import QuickSpend from '../components/finance/QuickSpend'
import BillsSection from '../components/finance/BillsSection'
import RecurringForecastSection from '../components/finance/RecurringForecastSection'
import BudgetSection from '../components/finance/BudgetSection'
import PlanSection from '../components/finance/PlanSection'
import SubscriptionsSection from '../components/finance/SubscriptionsSection'
import GoalsSection from '../components/finance/GoalsSection'
import SpendChart from '../components/finance/SpendChart'
import ItemSheet from '../components/ItemSheet'
import ItemList from '../components/ItemList'

/**
 * The 'money' area kind's dedicated page — the one view not rendered by
 * the generic AreaView, same mechanism as Journal/Habits/Nudges. All
 * math comes from lib/finance.js; this file only lays out sections.
 */
export default function FinanceDashboard() {
  const area = areaById('finance')
  const [month, setMonth] = useState(() => monthKey(todayKey()))
  const [sheetItem, setSheetItem] = useState(null)
  const [otherDraft, setOtherDraft] = useState('')
  const items = useStore(useShallow(selectAreaItems('finance')))
  const logs = useStore((s) => s.logs)
  const addItem = useStore((s) => s.addItem)

  const summary = budgetSummary(items, logs, month)
  const current = month === monthKey(todayKey())
  const daysLeft = current ? daysInMonth(month) - Number(todayKey().slice(8, 10)) : 0
  const pct = summary.limits > 0 ? Math.min(100, (summary.spent / summary.limits) * 100) : 0

  const monthLabel = new Date(`${month}-15T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="page" style={{ '--area-c1': `var(--trim-${area.trim})` }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name={area.icon} /></div>
        <h1>{area.name}</h1>
      </div>

      <div className="fin-month">
        <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <span>{monthLabel}</span>
        <button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>

      <section className="fin-section card">
        <div className="fin-headline">
          <strong>{formatCents(summary.spent)}</strong>
          <span className="fin-sub"> of {formatCents(summary.limits)} spending</span>
          {current && <span className="fin-sub"> · {daysLeft}d left</span>}
        </div>
        <div className="fin-track"><div className="fin-fill" style={{ width: `${pct}%` }} /></div>
        <div className="fin-planline">
          <span>Income {formatCents(summary.income)}</span>
          <span>Fixed {formatCents(summary.fixed)}</span>
          <span>Savings {formatCents(summary.savingsPlan)}</span>
          <span className={summary.unallocated < 0 ? 'fin-neg' : ''}>Unallocated {formatCents(summary.unallocated)}</span>
        </div>
      </section>

      <QuickSpend categories={items.filter((i) => i.bucket === 'Spending')} isCurrentMonth={current} />
      <SpendChart items={items} logs={logs} month={month} />
      <SubscriptionsSection items={items} onEdit={setSheetItem} />
      <BillsSection items={items} logs={logs} onEdit={setSheetItem} />
      <RecurringForecastSection items={items} month={month} monthLabel={monthLabel} onEdit={setSheetItem} />
      <div className="fin-grid">
        <div className="fin-col">
          <BudgetSection items={items} logs={logs} month={month} onEdit={setSheetItem} />
          <GoalsSection items={items} logs={logs} onEdit={setSheetItem} />
        </div>
        <div className="fin-col">
          <PlanSection items={items} onEdit={setSheetItem} />
        </div>
      </div>

      <section className="fin-section card">
        <h3>Other</h3>
        <ItemList items={items.filter((i) => i.bucket === 'Other')} areaId="finance" />
        <div className="fin-addrow">
          <input
            className="fin-title" placeholder="Add a note-style item…"
            value={otherDraft} onChange={(e) => setOtherDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && otherDraft.trim()) {
                addItem('finance', otherDraft, { bucket: 'Other' })
                setOtherDraft('')
              }
            }}
          />
        </div>
      </section>

      {sheetItem && <ItemSheet item={sheetItem} onClose={() => setSheetItem(null)} />}
    </div>
  )
}
