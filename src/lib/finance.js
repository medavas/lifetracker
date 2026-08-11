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
  const months = cadence === 'yearly' ? 12 : cadence === 'biannual' ? 6 : 1
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
  if (item.cadence === 'biannual') return Math.round(amount / 6)
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
 *
 * INVARIANT: totalSpend sums every live 'spend' log regardless of the
 * resolved item's bucket (not structurally scoped to Spending) — safe
 * only because QuickSpend.jsx is the sole logSpend() call site and only
 * offers Spending-bucket categories; a future non-Spending logSpend call
 * site would need this filtered by bucket.
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

/**
 * Every occurrence of a recurring bill/subscription that lands in `month`,
 * projected forward from `nextDue` by repeated advanceDue. Pure forecast —
 * doesn't touch the store or the payment ledger, so an autopay bill that
 * never gets a manual "Paid" click (nextDue sitting frozen) still shows up
 * in every month it would actually hit, not just the one nextDue is
 * currently parked in.
 */
export function monthForecast(items, month) {
  const start = `${month}-01`
  const end = `${month}-${pad2(daysInMonth(month))}`
  const occurrences = []
  for (const i of financeItems(items)) {
    if ((i.bucket !== 'Bills' && i.bucket !== 'Subscriptions') || !i.nextDue || !i.cadence) continue
    let due = i.nextDue
    for (let guard = 0; guard < 200 && due <= end; guard++) {
      if (due >= start) occurrences.push({ ...i, dueDate: due })
      due = advanceDue(due, i.cadence)
    }
  }
  return occurrences.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
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

// ── Category colors ───────────────────────────────────────────
// A spending category owns a color so the same money reads the same way in
// the budget list, the log chips and the chart. The slot is STORED on the
// item (`color`, 1..SPEND_SERIES) rather than derived from position, so
// archiving or reordering a category never repaints the others — and never
// repaints past months, where the color is the only label a bar segment has.

export const SPEND_SERIES = 8

/**
 * Deterministic 1..SPEND_SERIES from an id — the fallback for a category
 * that predates `color` and reached this device by sync rather than by the
 * v3 -> v4 migration. Stable for the life of the id, so it behaves like a
 * stored slot even though nothing was written.
 */
function hashSeries(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000003
  return (h % SPEND_SERIES) + 1
}

/** The --series-N slot a category renders as. */
export const categorySeries = (item) =>
  item?.color >= 1 && item.color <= SPEND_SERIES ? item.color : hashSeries(item?.id ?? '')

/**
 * The slot a NEW category should take: the lowest one no live category is
 * using, so the first eight are all distinct. Past eight it wraps — a
 * repeat is better than a ninth color the palette hasn't validated.
 */
export function nextCategoryColor(items) {
  const cats = financeItems(items).filter((i) => i.bucket === 'Spending')
  const used = new Set(cats.map(categorySeries))
  for (let c = 1; c <= SPEND_SERIES; c++) if (!used.has(c)) return c
  return (cats.length % SPEND_SERIES) + 1
}

// ── Spend over time, split by category ────────────────────────

/** A spend log whose category no longer resolves still happened. */
export const UNCATEGORIZED = 'uncategorized'

/**
 * The month's spending split into columns and, within a column, by
 * category — the shape `stackGeometry` consumes (`.total` + `.bands`).
 *
 * `grain: 'week'` groups in sevens from the 1st rather than by calendar
 * week: every column is then the same seven days wide except a short tail,
 * where Mon-aligned weeks would leave a stub at BOTH ends of the month and
 * make the first bar look like a spending drop that never happened.
 */
export function spendPeriods(items, logs, month, grain = 'day') {
  const size = grain === 'week' ? 7 : 1
  const last = daysInMonth(month)
  const periods = []
  for (let start = 1; start <= last; start += size) {
    const end = Math.min(last, start + size - 1)
    periods.push({ date: `${month}-${pad2(start)}`, start, end, total: 0, bands: {} })
  }

  const known = new Set(items.filter((i) => !i.deletedAt).map((i) => i.id))
  for (const l of liveLogs(logs, month)) {
    if (l.kind !== 'spend') continue
    const p = periods[Math.floor((Number(l.date.slice(8, 10)) - 1) / size)]
    if (!p) continue
    const key = l.itemId && known.has(l.itemId) ? l.itemId : UNCATEGORIZED
    const amount = l.amount ?? 0
    p.bands[key] = (p.bands[key] ?? 0) + amount
    p.total += amount
  }
  return periods
}

/**
 * The bands to stack and to legend, biggest spender first so the tallest
 * blocks sit at the bottom of every column. Only categories with money in
 * the month appear — an empty legend row is a color to learn for nothing.
 */
export function spendBands(items, logs, month) {
  const { spendByCategory } = monthActuals(items, logs, month)
  const bands = financeItems(items)
    .filter((i) => i.bucket === 'Spending' && (spendByCategory[i.id] ?? 0) > 0)
    .map((i) => ({ id: i.id, name: i.title, series: categorySeries(i), total: spendByCategory[i.id] }))
    .sort((a, b) => b.total - a.total)
  if (spendByCategory[UNCATEGORIZED] > 0) {
    bands.push({ id: UNCATEGORIZED, name: 'Uncategorized', series: 0, total: spendByCategory[UNCATEGORIZED] })
  }
  return bands
}
