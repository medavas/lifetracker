import { describe, it, expect } from 'vitest'
import { monthKey, daysInMonth, addDays, advanceDue, monthlyize } from '../finance.js'

describe('date helpers', () => {
  it('monthKey takes the YYYY-MM prefix', () => {
    expect(monthKey('2026-08-06')).toBe('2026-08')
    expect(monthKey('2026-08')).toBe('2026-08')
  })

  it('daysInMonth handles length and leap years', () => {
    expect(daysInMonth('2026-01')).toBe(31)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-04')).toBe(30)
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-06', 14)).toBe('2026-08-20')
    expect(addDays('2026-08-25', 14)).toBe('2026-09-08')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('advanceDue', () => {
  it('monthly advances one month, clamped to month end', () => {
    expect(advanceDue('2026-08-15', 'monthly')).toBe('2026-09-15')
    expect(advanceDue('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceDue('2026-12-15', 'monthly')).toBe('2027-01-15')
  })

  it('yearly advances one year, clamping Feb 29', () => {
    expect(advanceDue('2026-03-01', 'yearly')).toBe('2027-03-01')
    expect(advanceDue('2028-02-29', 'yearly')).toBe('2029-02-28')
  })

  it('weekly advances seven days', () => {
    expect(advanceDue('2026-08-28', 'weekly')).toBe('2026-09-04')
  })
})

describe('monthlyize', () => {
  it('passes monthly through, divides yearly, scales weekly', () => {
    expect(monthlyize({ amount: 1500, cadence: 'monthly' })).toBe(1500)
    expect(monthlyize({ amount: 12000, cadence: 'yearly' })).toBe(1000)
    expect(monthlyize({ amount: 1000, cadence: 'weekly' })).toBe(4333)
  })

  it('defaults a missing cadence to monthly and a missing amount to 0', () => {
    expect(monthlyize({ amount: 900 })).toBe(900)
    expect(monthlyize({ cadence: 'monthly' })).toBe(0)
  })
})

import {
  financeItems, monthActuals, budgetSummary, upcomingBills,
  goalProgress, subscriptionRollup, dailySpend, spendBars,
} from '../finance.js'

const fin = (bucket, extra = {}) => ({
  id: extra.id ?? `${bucket}-${Math.random().toString(36).slice(2, 7)}`,
  areaId: 'finance', bucket, title: extra.title ?? bucket,
  status: 'open', deletedAt: null, ...extra,
})
const spend = (itemId, amount, date, extra = {}) =>
  ({ id: `l-${Math.random().toString(36).slice(2, 7)}`, itemId, areaId: 'finance', kind: 'spend', amount, date, deletedAt: null, ...extra })

describe('financeItems', () => {
  it('keeps live finance items, drops archived, deleted, and other areas', () => {
    const items = [
      fin('Bills', { id: 'b1' }),
      fin('Bills', { id: 'b2', status: 'archived' }),
      fin('Bills', { id: 'b3', deletedAt: 123 }),
      { id: 'x', areaId: 'fitness', bucket: 'Goals', status: 'open', deletedAt: null },
    ]
    expect(financeItems(items).map((i) => i.id)).toEqual(['b1'])
  })
})

describe('monthActuals', () => {
  const cat = fin('Spending', { id: 'groceries', amount: 40000 })

  it('sums spends per category for the month only', () => {
    const logs = [
      spend('groceries', 1450, '2026-08-02'),
      spend('groceries', 550, '2026-08-15'),
      spend('groceries', 9999, '2026-07-30'),
    ]
    const a = monthActuals([cat], logs, '2026-08')
    expect(a.spendByCategory.groceries).toBe(2000)
    expect(a.totalSpend).toBe(2000)
  })

  it('routes spends with a missing item to uncategorized', () => {
    const a = monthActuals([cat], [spend('gone-id', 700, '2026-08-03'), spend(null, 300, '2026-08-04')], '2026-08')
    expect(a.spendByCategory.uncategorized).toBe(1000)
    expect(a.totalSpend).toBe(1000)
  })

  it('ignores tombstoned logs and tallies bill-pays and contributions separately', () => {
    const logs = [
      spend('groceries', 500, '2026-08-01', { deletedAt: 5 }),
      { id: 'p1', itemId: 'rent', areaId: 'finance', kind: 'bill-pay', amount: 120000, date: '2026-08-01', deletedAt: null },
      { id: 'c1', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 10000, date: '2026-08-02', deletedAt: null },
    ]
    const a = monthActuals([cat], logs, '2026-08')
    expect(a.totalSpend).toBe(0)
    expect(a.billsPaid).toBe(120000)
    expect(a.contributed).toBe(10000)
  })
})

describe('budgetSummary', () => {
  const items = [
    fin('Plan', { id: 'sal', type: 'income', amount: 500000 }),
    fin('Plan', { id: 'sav', type: 'savings', amount: 50000 }),
    fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly', nextDue: '2026-08-01' }),
    fin('Subscriptions', { id: 'tv', amount: 12000, cadence: 'yearly', nextDue: '2027-01-10' }),
    fin('Spending', { id: 'groceries', amount: 40000 }),
    fin('Spending', { id: 'fun', amount: 20000 }),
  ]

  it('computes income, fixed, limits, and the unallocated remainder', () => {
    const s = budgetSummary(items, [], '2026-08')
    expect(s.income).toBe(500000)
    expect(s.savingsPlan).toBe(50000)
    expect(s.fixed).toBe(121000) // rent 1200.00 + tv 120.00/12 = 10.00
    expect(s.limits).toBe(60000)
    expect(s.unallocated).toBe(500000 - 121000 - 50000 - 60000)
  })

  it('tracks spent and remaining against the limits', () => {
    const s = budgetSummary(items, [spend('groceries', 15000, '2026-08-05')], '2026-08')
    expect(s.spent).toBe(15000)
    expect(s.remaining).toBe(45000)
  })
})

describe('upcomingBills', () => {
  const items = [
    fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly', nextDue: '2026-08-10' }),
    fin('Subscriptions', { id: 'tv', amount: 1500, cadence: 'monthly', nextDue: '2026-08-08' }),
    fin('Bills', { id: 'late', amount: 4000, cadence: 'monthly', nextDue: '2026-08-01' }),
    fin('Bills', { id: 'far', amount: 9000, cadence: 'monthly', nextDue: '2026-09-25' }),
    fin('Bills', { id: 'nodate', amount: 5000, cadence: 'monthly' }),
  ]

  it('returns overdue + due-within-horizon, sorted by date', () => {
    const bills = upcomingBills(items, '2026-08-06', 14)
    expect(bills.map((b) => b.id)).toEqual(['late', 'tv', 'rent'])
    expect(bills.find((b) => b.id === 'late').overdue).toBe(true)
    expect(bills.find((b) => b.id === 'rent').overdue).toBe(false)
  })
})

describe('goals + subscriptions', () => {
  it('goalProgress sums live contribute logs for the goal', () => {
    const logs = [
      { id: '1', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 10000, date: '2026-07-01', deletedAt: null },
      { id: '2', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 5000, date: '2026-08-01', deletedAt: null },
      { id: '3', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 9999, date: '2026-08-02', deletedAt: 7 },
      { id: '4', itemId: 'g2', areaId: 'finance', kind: 'contribute', amount: 777, date: '2026-08-02', deletedAt: null },
    ]
    expect(goalProgress(logs, 'g1')).toBe(15000)
  })

  it('subscriptionRollup totals the Subscriptions bucket monthly and yearly', () => {
    const items = [
      fin('Subscriptions', { id: 'a', amount: 1500, cadence: 'monthly' }),
      fin('Subscriptions', { id: 'b', amount: 12000, cadence: 'yearly' }),
      fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly' }),
    ]
    const r = subscriptionRollup(items)
    expect(r.monthly).toBe(2500)
    expect(r.yearly).toBe(30000)
  })
})

describe('dailySpend + spendBars', () => {
  it('buckets spend logs by day of month', () => {
    const logs = [
      spend('c', 1000, '2026-08-01'),
      spend('c', 500, '2026-08-01'),
      spend('c', 200, '2026-08-31'),
      spend('c', 9999, '2026-07-31'),
      { id: 'p', itemId: 'rent', areaId: 'finance', kind: 'bill-pay', amount: 99, date: '2026-08-01', deletedAt: null },
    ]
    const days = dailySpend(logs, '2026-08')
    expect(days).toHaveLength(31)
    expect(days[0]).toBe(1500)
    expect(days[30]).toBe(200)
    expect(days[1]).toBe(0)
  })

  it('spendBars scales heights to the max day within the plot box', () => {
    const bars = spendBars([1000, 0, 500], { width: 90, height: 100, pad: 0, gap: 0 })
    expect(bars).toHaveLength(3)
    expect(bars[0].h).toBe(100)
    expect(bars[2].h).toBe(50)
    expect(bars[1].h).toBe(0)
    expect(bars[0].w).toBe(30)
    expect(bars[2].x).toBe(60)
    expect(bars[0].y).toBe(0)
    expect(bars[2].y).toBe(50)
  })
})
