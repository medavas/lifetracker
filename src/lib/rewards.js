/**
 * Reward engine — points, levels, streaks.
 * Pure functions over store state; tune the constants to taste.
 */

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

/** Activity counts for the last n days (for the dashboard chart). */
export function activityByDay(logs, n = 7) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const date = daysAgoKey(i)
    out.push({ date, count: logs.filter((l) => l.date === date).length })
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
