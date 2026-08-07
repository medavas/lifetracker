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
import BudgetSection from '../components/finance/BudgetSection'
import PlanSection from '../components/finance/PlanSection'
import SubscriptionsSection from '../components/finance/SubscriptionsSection'
import ItemSheet from '../components/ItemSheet'

/**
 * The 'money' area kind's dedicated page — the one view not rendered by
 * the generic AreaView, same mechanism as Journal/Habits/Nudges. All
 * math comes from lib/finance.js; this file only lays out sections.
 */
export default function FinanceDashboard() {
  const area = areaById('finance')
  const [month, setMonth] = useState(() => monthKey(todayKey()))
  const [sheetItem, setSheetItem] = useState(null)
  const items = useStore(useShallow(selectAreaItems('finance')))
  const logs = useStore((s) => s.logs)

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

      <QuickSpend categories={items.filter((i) => i.bucket === 'Spending')} />
      <BillsSection items={items} onEdit={setSheetItem} />
      <div className="fin-grid">
        <div className="fin-col">
          <BudgetSection items={items} logs={logs} month={month} onEdit={setSheetItem} />
        </div>
        <div className="fin-col">
          <SubscriptionsSection items={items} onEdit={setSheetItem} />
          <PlanSection items={items} onEdit={setSheetItem} />
        </div>
      </div>
      {sheetItem && <ItemSheet item={sheetItem} onClose={() => setSheetItem(null)} />}

      {/* Task 9-10 fill these in: GoalsSection, SpendChart, Other */}
    </div>
  )
}
