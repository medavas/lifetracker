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
