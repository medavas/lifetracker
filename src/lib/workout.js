/**
 * Pure workout math — no store imports, no Date.now(), fully unit-tested.
 * Same house pattern as lib/finance.js and lib/chart.js: vitest runs in node
 * with no DOM, so anything a component needs computed lives here.
 *
 * An EXERCISE is an ITEM (a sub-item of its session item) carrying
 * { sets, low, high, step }; every function here takes that item and reads
 * its spec through `exerciseSpec`, so an exercise the user typed in by hand
 * with no numbers still behaves sensibly.
 *
 * A logged set is a LOG of kind 'set':
 *   { id, itemId, areaId: 'fitness', kind: 'set', date, weight, reps }
 * where `itemId` is the exercise item.
 *
 * `step` is the SIGNED weight jump taken when a rep range tops out. Negative
 * means an assistance machine, where less weight is more strength — every
 * function that reasons about progression honors that direction rather than
 * carrying a separate boolean.
 */

import { exerciseSpec, SESSION_BUCKET } from '../data/workoutProgram'

export const SET_KIND = 'set'

/**
 * Every exercise ever attached to a session, ARCHIVED INCLUDED, keyed by id.
 * The logger only shows live ones, but the chart and the history list must
 * still be able to name an exercise that has since been retired — its logged
 * sets did not stop having happened.
 *
 * A plain function rather than a store selector on purpose: it builds a fresh
 * Map, which zustand's snapshot comparison would treat as a change on every
 * render. Callers memoize it against `items`.
 */
export function buildExerciseIndex(items) {
  const sessions = new Set(
    items.filter((i) => !i.deletedAt && i.bucket === SESSION_BUCKET).map((i) => i.id),
  )
  const index = new Map()
  for (const i of items) {
    if (!i.deletedAt && i.parentId && sessions.has(i.parentId)) index.set(i.id, i)
  }
  return index
}

const byCreated = (a, b) => a.createdAt - b.createdAt

/** True when progress means the number going DOWN (an assistance machine). */
export const isAssisted = (exercise) => exerciseSpec(exercise).step < 0

/** Every live set log, unsorted. */
export const liveSets = (logs) =>
  logs.filter((l) => !l.deletedAt && l.kind === SET_KIND)

/** One exercise's sets on one date, in the order they were logged. */
export const setsOn = (logs, exerciseId, date) =>
  liveSets(logs)
    .filter((l) => l.itemId === exerciseId && l.date === date)
    .sort(byCreated)

/** Every date any set was logged, most recent first. */
export function sessionDates(logs) {
  return [...new Set(liveSets(logs).map((l) => l.date))].sort().reverse()
}

/**
 * The most recent session BEFORE `date` in which this exercise was trained.
 * Null when it has never been done — that is the "find a working weight"
 * case, not an error.
 */
export function lastPerformance(logs, exerciseId, beforeDate) {
  const prior = liveSets(logs).filter((l) => l.itemId === exerciseId && l.date < beforeDate)
  if (prior.length === 0) return null
  const date = prior.reduce((max, l) => (l.date > max ? l.date : max), prior[0].date)
  return { date, sets: prior.filter((l) => l.date === date).sort(byCreated) }
}

/**
 * The working weight of a session: the heaviest weight used (the lightest
 * assist, on an assistance machine). Warm-ups and drop-offs at other weights
 * are ignored, so a bad last set can't drag the target down.
 */
export function workingWeight(sets, exercise) {
  if (sets.length === 0) return null
  const weights = sets.map((s) => s.weight ?? 0)
  return isAssisted(exercise) ? Math.min(...weights) : Math.max(...weights)
}

/**
 * Double progression, the entire program in one function.
 *
 * Hit the top of the rep range on every target set -> take one `step` of
 * weight and drop back to the bottom of the range. Otherwise keep the weight
 * and add one rep to the weakest set. Never done before -> start at the
 * bottom of the range and let the first session find the weight.
 *
 * Returns { weight, reps, advance }, where `weight` is null only in the
 * first-time case and `advance` is 'start' | 'reps' | 'weight'.
 */
export function nextTarget(exercise, last) {
  const spec = exerciseSpec(exercise)
  if (!last || last.sets.length === 0) {
    return { weight: null, reps: spec.low, advance: 'start' }
  }
  const weight = workingWeight(last.sets, exercise)
  const working = last.sets.filter((s) => (s.weight ?? 0) === weight)
  const toppedOut = working.length >= spec.sets && working.every((s) => s.reps >= spec.high)

  if (toppedOut) {
    // `step` is signed, so this both adds plate weight and removes assistance.
    // Zero is the floor either way: on an assistance machine that is an
    // unassisted rep, the end of the ladder.
    return { weight: Math.max(0, weight + spec.step), reps: spec.low, advance: 'weight' }
  }
  const weakest = Math.min(...working.map((s) => s.reps))
  return { weight, reps: Math.min(spec.high, weakest + 1), advance: 'reps' }
}

/** Pounds moved: the sum of weight x reps. */
export const volumeOf = (sets) =>
  sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)

/**
 * One point per session for an exercise's progression chart: the best set of
 * that day, oldest first. "Best" is the working weight, and among the sets at
 * that weight the one with the most reps — so a week that added reps at the
 * same weight still reads as progress in the tooltip.
 */
export function topSetSeries(logs, exercise, limit = 12) {
  const mine = liveSets(logs).filter((l) => l.itemId === exercise.id)
  const dates = [...new Set(mine.map((l) => l.date))].sort()
  const points = dates.map((date) => {
    const sets = mine.filter((l) => l.date === date)
    const weight = workingWeight(sets, exercise)
    const reps = Math.max(...sets.filter((s) => (s.weight ?? 0) === weight).map((s) => s.reps))
    return { date, weight, reps, sets: sets.length, volume: volumeOf(sets) }
  })
  return points.slice(-limit)
}

/**
 * SVG line geometry for a progression series (the spendBars house pattern —
 * SVG y grows downward, so a bigger value gets a smaller y).
 *
 * The y-axis deliberately does NOT start at zero: this chart's job is change
 * over time, and a 135->140 lb week is invisible against one. The component
 * is required to label `min`/`max` so the scale is never implied. A flat
 * series (one point, or no change yet) is centered rather than divided by a
 * zero range.
 */
export function lineGeometry(points, opts = {}) {
  const { width = 320, height = 96, padX = 10, padY = 12 } = opts
  const values = points.map((p) => p.weight ?? 0)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const span = max - min
  const plotH = height - padY * 2
  const usableW = width - padX * 2

  const pts = points.map((p, i) => ({
    ...p,
    x: points.length === 1 ? width / 2 : padX + (i / (points.length - 1)) * usableW,
    y: span === 0 ? height / 2 : padY + (1 - ((p.weight ?? 0) - min) / span) * plotH,
  }))

  return {
    pts,
    min,
    max,
    path: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
  }
}

/**
 * A day's totals for the history list. `exerciseIndex` is the id -> exercise
 * item map (archived included), so a day still names its session correctly
 * after an exercise has been dropped from the program.
 *
 * The session is derived from the exercises actually logged rather than
 * stored on the log: the exercise already knows its parent, so a set log
 * needs no session field of its own.
 */
export function sessionSummary(logs, exerciseIndex, date) {
  const sets = liveSets(logs).filter((l) => l.date === date)
  const exercises = [...new Set(sets.map((l) => l.itemId))]

  const byParent = new Map()
  for (const id of exercises) {
    const parentId = exerciseIndex.get(id)?.parentId
    if (parentId) byParent.set(parentId, (byParent.get(parentId) ?? 0) + 1)
  }
  let sessionId = null
  let best = 0
  for (const [parentId, hits] of byParent) {
    if (hits > best) {
      sessionId = parentId
      best = hits
    }
  }

  return { date, setCount: sets.length, volume: volumeOf(sets), exercises, sessionId }
}

/** Sessions trained on or after `fromDate` — the "2 of 3 this week" counter. */
export const sessionCountSince = (logs, fromDate) =>
  sessionDates(logs).filter((d) => d >= fromDate).length

/** How a weight reads in the UI. 0 is bodyweight, not "zero pounds". */
export const formatWeight = (weight) =>
  weight == null ? '—' : weight === 0 ? 'BW' : `${weight} lb`

/** An exercise's target, as it reads on the row: "3 × 8–12". */
export function formatTarget(exercise) {
  const { sets, low, high } = exerciseSpec(exercise)
  return `${sets} × ${low === high ? low : `${low}–${high}`}`
}
