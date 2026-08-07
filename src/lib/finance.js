/**
 * Pure finance math — no store imports, no Date.now(), fully unit-tested
 * (the chart.js/stackGeometry house pattern: vitest runs in node with no
 * DOM, so anything a component needs computed lives here instead).
 *
 * All amounts are integer cents. All dates are local 'YYYY-MM-DD' strings;
 * arithmetic parses the parts and reconstructs via UTC so a timezone can
 * never shift a day.
 */

export const monthKey = (dateStr) => dateStr.slice(0, 7)

/** 'YYYY-MM' plus delta months. */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad2((total % 12 + 12) % 12 + 1)}`
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const pad2 = (n) => String(n).padStart(2, '0')

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/**
 * Next occurrence of a bill. Monthly/yearly clamp to the destination
 * month's last day (Jan 31 -> Feb 28). Deliberately NOT reversible —
 * un-paying restores the payment log's `prevDue` instead of reversing
 * this math, because a clamped date can't be walked back (Feb 28 would
 * "retreat" to Jan 28).
 */
export function advanceDue(dateStr, cadence) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (cadence === 'weekly') return addDays(dateStr, 7)
  const months = cadence === 'yearly' ? 12 : 1
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`
}

/** Per-month cost of a bill/subscription item, in cents. */
export function monthlyize(item) {
  const amount = item.amount ?? 0
  if (item.cadence === 'yearly') return Math.round(amount / 12)
  if (item.cadence === 'weekly') return Math.round((amount * 52) / 12)
  return amount
}

/** Live (not deleted, not archived) finance-area items. */
export const financeItems = (items) =>
  items.filter((i) => !i.deletedAt && i.areaId === 'finance' && i.status !== 'archived')

const liveLogs = (logs, month) =>
  logs.filter((l) => !l.deletedAt && l.date.startsWith(month))

/**
 * The month's money movement. Spends whose item no longer resolves land
 * under 'uncategorized' — the money actually left, so totals stay
 * truthful even after a category is hard-deleted.
 */
export function monthActuals(items, logs, month) {
  const known = new Set(items.filter((i) => !i.deletedAt).map((i) => i.id))
  const spendByCategory = {}
  let totalSpend = 0
  let billsPaid = 0
  let contributed = 0
  for (const l of liveLogs(logs, month)) {
    const amount = l.amount ?? 0
    if (l.kind === 'spend') {
      const key = l.itemId && known.has(l.itemId) ? l.itemId : 'uncategorized'
      spendByCategory[key] = (spendByCategory[key] ?? 0) + amount
      totalSpend += amount
    } else if (l.kind === 'bill-pay') {
      billsPaid += amount
    } else if (l.kind === 'contribute') {
      contributed += amount
    }
  }
  return { spendByCategory, totalSpend, billsPaid, contributed }
}

const sumAmounts = (list) => list.reduce((s, i) => s + (i.amount ?? 0), 0)

/**
 * The monthly plan vs. this month's reality, all cents.
 * Plan-bucket items are discriminated by ITEM `type`:
 * 'income' rows sum to income, 'savings' rows to the savings allocation.
 */
export function budgetSummary(items, logs, month) {
  const live = financeItems(items)
  const plan = live.filter((i) => i.bucket === 'Plan')
  const income = sumAmounts(plan.filter((i) => i.type === 'income'))
  const savingsPlan = sumAmounts(plan.filter((i) => i.type === 'savings'))
  const fixed = live
    .filter((i) => i.bucket === 'Bills' || i.bucket === 'Subscriptions')
    .reduce((s, i) => s + monthlyize(i), 0)
  const limits = sumAmounts(live.filter((i) => i.bucket === 'Spending'))
  const { totalSpend } = monthActuals(items, logs, month)
  return {
    income, savingsPlan, fixed, limits,
    unallocated: income - fixed - savingsPlan - limits,
    spent: totalSpend,
    remaining: limits - totalSpend,
  }
}

/** Bills + subscriptions due within the horizon (or overdue), soonest first. */
export function upcomingBills(items, todayStr, horizonDays = 14) {
  const limit = addDays(todayStr, horizonDays)
  return financeItems(items)
    .filter((i) => (i.bucket === 'Bills' || i.bucket === 'Subscriptions') && i.nextDue && i.nextDue <= limit)
    .map((i) => ({ ...i, overdue: i.nextDue < todayStr }))
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))
}

/** Total saved toward a goal: the sum of its live contribute logs. */
export const goalProgress = (logs, goalId) =>
  logs
    .filter((l) => !l.deletedAt && l.kind === 'contribute' && l.itemId === goalId)
    .reduce((s, l) => s + (l.amount ?? 0), 0)

/** What all subscriptions cost, per month and per year. */
export function subscriptionRollup(items) {
  const subs = financeItems(items).filter((i) => i.bucket === 'Subscriptions')
  const monthly = subs.reduce((s, i) => s + monthlyize(i), 0)
  return { monthly, yearly: monthly * 12 }
}

/** Cents spent per day of the month, index 0 = day 1. 'spend' logs only. */
export function dailySpend(logs, month) {
  const days = new Array(daysInMonth(month)).fill(0)
  for (const l of liveLogs(logs, month)) {
    if (l.kind !== 'spend') continue
    days[Number(l.date.slice(8, 10)) - 1] += l.amount ?? 0
  }
  return days
}

/**
 * SVG bar geometry for the daily-spend chart, kept out of the component
 * so it can be tested (stackGeometry pattern — SVG y grows downward).
 */
export function spendBars(dayTotals, opts = {}) {
  const { width = 320, height = 96, pad = 4, gap = 2 } = opts
  const colW = (width - pad * 2) / Math.max(1, dayTotals.length)
  const max = Math.max(1, ...dayTotals)
  return dayTotals.map((total, i) => {
    const h = (total / max) * height
    return {
      day: i + 1,
      x: pad + i * colW + gap / 2,
      y: height - h,
      w: Math.max(1, colW - gap),
      h,
      total,
    }
  })
}
