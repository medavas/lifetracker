/**
 * Reward engine — points, levels, streaks.
 * Pure functions over store state; tune the constants to taste.
 */

import { DAILY_BANDS } from '../data/areas.js'

export const POINTS = {
  task: 10, // completing any item
  habit: 5, // a daily habit check-in
  journal: 15, // first journal entry of the day
}

/** Level curve: gently super-linear. Level 1 -> 0 pts, 2 -> 100, 3 -> 283, 4 -> 520… */
export function levelForPoints(points) {
  return Math.max(1, Math.floor(Math.sqrt(points / 100) + 1))
}

export function pointsForLevel(level) {
  return Math.round(100 * Math.pow(level - 1, 2))
}

/** Progress (0..1) toward the next level. */
export function levelProgress(points) {
  const lvl = levelForPoints(points)
  const base = pointsForLevel(lvl)
  const next = pointsForLevel(lvl + 1)
  return next === base ? 0 : (points - base) / (next - base)
}

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysAgoKey(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return todayKey(d)
}

/**
 * Current streak for a habit: consecutive days checked, counting back from
 * today (today itself is optional — an unchecked today doesn't break it yet).
 */
export function habitStreak(logs, itemId) {
  const days = new Set(
    logs.filter((l) => l.itemId === itemId && l.kind === 'habit-check').map((l) => l.date),
  )
  let streak = 0
  let offset = days.has(todayKey()) ? 0 : 1
  for (let i = offset; ; i++) {
    if (days.has(daysAgoKey(i))) streak++
    else break
  }
  return streak
}

/** Local day key for a note's createdAt timestamp, matching LOG `date` values. */
const dayKeyOf = (ts) => todayKey(new Date(ts))

/**
 * Counts for one day, one key per daily band. Switched on the area's `kind`
 * so a fifth daily area needs no change here.
 *
 * Journal counts NOTEs, not the `kind:'journal'` day-marker log: the store
 * writes at most one marker per day, which would cap the band at 1 while
 * habits reach 6+, making journaling render as a permanent sliver.
 */
export function bandCounts(logs, notes, date) {
  const live = logs.filter((l) => !l.deletedAt)
  const liveNotes = notes.filter((n) => !n.deletedAt)
  const out = {}
  for (const area of DAILY_BANDS) {
    if (area.kind === 'journal') {
      out[area.id] = liveNotes.filter(
        (n) => n.areaId === area.id && !n.itemId && dayKeyOf(n.createdAt) === date,
      ).length
    } else if (area.kind === 'habits') {
      out[area.id] = live.filter(
        (l) => l.kind === 'habit-check' && l.areaId === area.id && l.date === date,
      ).length
    } else {
      out[area.id] = live.filter(
        (l) => l.kind === 'complete' && l.areaId === area.id && l.date === date,
      ).length
    }
  }
  return out
}

/**
 * Band counts for the last n days, oldest first. Every day in the window is
 * present, including days with no activity, so the chart keeps a stable width.
 */
export function dailyActivity(logs, notes, n = 7) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const date = daysAgoKey(i)
    const bands = bandCounts(logs, notes, date)
    const total = Object.values(bands).reduce((s, v) => s + v, 0)
    out.push({ date, bands, total })
  }
  return out
}

/**
 * Points are DERIVED from logs so they never need cross-device merging.
 * Each 'complete' log awards POINTS.task, each 'habit-check' log awards
 * POINTS.habit, and each distinct journal day awards POINTS.journal once.
 * Tombstoned logs don't count.
 */
export function computePoints(logs) {
  const live = logs.filter((l) => !l.deletedAt)
  let pts = 0
  for (const l of live) {
    if (l.kind === 'complete') pts += POINTS.task
    else if (l.kind === 'habit-check') pts += POINTS.habit
  }
  const journalDays = new Set(live.filter((l) => l.kind === 'journal').map((l) => l.date))
  return pts + journalDays.size * POINTS.journal
}

/** The Monday of d's week, as a local YYYY-MM-DD key. */
export function startOfWeekKey(d = new Date()) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return todayKey(x)
}

/**
 * Presence booleans over a rolling window of `weeks` calendar weeks ending
 * with the current one. Outer array is weeks oldest-first, inner is Mon..Sun,
 * so the block is always exactly weeks x 7 and the oldest week drops off as a
 * new one begins. Days after today are flagged `future` so the grid can render
 * them as empty rather than as missed.
 */
export function dailyPresence(logs, notes, weeks = 5) {
  const today = todayKey()
  const first = new Date(startOfWeekKey() + 'T00:00:00')
  first.setDate(first.getDate() - (weeks - 1) * 7)

  const grid = []
  for (let w = 0; w < weeks; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(first)
      cell.setDate(first.getDate() + w * 7 + d)
      const date = todayKey(cell)
      const counts = bandCounts(logs, notes, date)
      const bands = {}
      for (const id of Object.keys(counts)) bands[id] = counts[id] > 0
      row.push({ date, bands, future: date > today })
    }
    grid.push(row)
  }
  return grid
}
