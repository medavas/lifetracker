/**
 * Pure date-bucketing over journal NOTEs for the year -> month -> day
 * drill-down. `year` is always a 4-digit string. `month` and `day` are
 * 1-indexed and accepted as either a number or a route-param string --
 * every comparison coerces with Number(). Every date part is read in LOCAL
 * time via new Date(ts).getFullYear()/getMonth()+1/getDate(), matching the
 * convention rewards.js's todayKey/dayKeyOf already use elsewhere.
 */

const isJournalEntry = (n) => n.areaId === 'journal' && !n.itemId && !n.deletedAt

const localParts = (ts) => {
  const d = new Date(ts)
  return { year: String(d.getFullYear()), month: d.getMonth() + 1, day: d.getDate() }
}

const currentYear = () => String(new Date().getFullYear())

/** Every year with a live journal entry, ascending, always including the current year. */
export function yearsWithEntries(notes) {
  const years = new Set([currentYear()])
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    years.add(localParts(n.createdAt).year)
  }
  return [...years].sort()
}

/** Which of the 12 months in `year` have at least one live entry. Index 0 = January. */
export function monthEntryFlags(notes, year) {
  const flags = new Array(12).fill(false)
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    const p = localParts(n.createdAt)
    if (p.year === year) flags[p.month - 1] = true
  }
  return flags
}

/** Which days of `year`/`month` have at least one live entry. Sized to that month's real day count. */
export function daysInMonth(notes, year, month) {
  const count = new Date(Number(year), Number(month), 0).getDate()
  if (!Number.isFinite(count)) return []
  const flags = new Array(count).fill(false)
  for (const n of notes) {
    if (!isJournalEntry(n)) continue
    const p = localParts(n.createdAt)
    if (p.year === year && p.month === Number(month)) flags[p.day - 1] = true
  }
  return flags
}

/** Live entries on exactly this day, oldest first -- a diary page reads top to bottom. */
export function entriesForDay(notes, year, month, day) {
  return notes
    .filter((n) => {
      if (!isJournalEntry(n)) return false
      const p = localParts(n.createdAt)
      return p.year === year && p.month === Number(month) && p.day === Number(day)
    })
    .sort((a, b) => a.createdAt - b.createdAt)
}
