/**
 * Pure workout math — no store imports, no Date.now(), fully unit-tested.
 * Same house pattern as lib/finance.js and lib/chart.js: vitest runs in node
 * with no DOM, so anything a component needs computed lives here.
 *
 * A logged set is a LOG of kind 'set':
 *   { id, itemId: null, areaId: 'fitness', kind: 'set', date, exercise, weight, reps }
 *
 * `exercise` holds a workoutProgram.js exercise id, NOT an item id — the
 * program is static config, so there is no ITEM to point at. itemId stays
 * null for the same reason.
 *
 * Weight is in pounds and may be 0 (bodyweight). For an `assisted` exercise
 * it is the ASSIST weight, so lower is stronger — every function that reasons
 * about progression takes the exercise config and honors that direction.
 */

import { SESSIONS, stepFor } from '../data/workoutProgram'

export const SET_KIND = 'set'

const byCreated = (a, b) => a.createdAt - b.createdAt

/** Every live set log, unsorted. */
export const liveSets = (logs) =>
  logs.filter((l) => !l.deletedAt && l.kind === SET_KIND)

/** One exercise's sets on one date, in the order they were logged. */
export const setsOn = (logs, exerciseId, date) =>
  liveSets(logs)
    .filter((l) => l.exercise === exerciseId && l.date === date)
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
  const prior = liveSets(logs).filter((l) => l.exercise === exerciseId && l.date < beforeDate)
  if (prior.length === 0) return null
  const date = prior.reduce((max, l) => (l.date > max ? l.date : max), prior[0].date)
  return { date, sets: prior.filter((l) => l.date === date).sort(byCreated) }
}

/**
 * The working weight of a session: the heaviest weight used (the lightest
 * assist, for an assisted machine). Warm-ups and drop-offs at other weights
 * are ignored, so a bad last set can't drag the target down.
 */
export function workingWeight(sets, exercise) {
  if (sets.length === 0) return null
  const weights = sets.map((s) => s.weight ?? 0)
  return exercise.assisted ? Math.min(...weights) : Math.max(...weights)
}

/**
 * Double progression, the entire program in one function.
 *
 * Hit the top of the rep range on every target set -> add a step of weight
 * and drop back to the bottom of the range. Otherwise keep the weight and
 * add one rep to the weakest set. Never done before -> start at the bottom
 * of the range and let the first session find the weight.
 *
 * Returns { weight, reps, advance }, where `weight` is null only in the
 * first-time case and `advance` is 'start' | 'reps' | 'weight'.
 */
export function nextTarget(exercise, last) {
  if (!last || last.sets.length === 0) {
    return { weight: null, reps: exercise.low, advance: 'start' }
  }
  const weight = workingWeight(last.sets, exercise)
  const working = last.sets.filter((s) => (s.weight ?? 0) === weight)
  const toppedOut =
    working.length >= exercise.sets && working.every((s) => s.reps >= exercise.high)

  if (toppedOut) {
    // Assisted machines run backwards: less assistance is more strength, and
    // 0 is the floor (that's an unassisted pull-up, the end of the ladder).
    const next = exercise.assisted
      ? Math.max(0, weight - stepFor(exercise))
      : weight + stepFor(exercise)
    return { weight: next, reps: exercise.low, advance: 'weight' }
  }
  const weakest = Math.min(...working.map((s) => s.reps))
  return { weight, reps: Math.min(exercise.high, weakest + 1), advance: 'reps' }
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
  const mine = liveSets(logs).filter((l) => l.exercise === exercise.id)
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
 * over time, and a 135->140 lb week is invisible against a zero baseline. The
 * component is required to label `min`/`max` so the scale is never implied.
 * A flat series (one point, or no change yet) is centered rather than divided
 * by a zero range.
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
 * Which session a day's work was: the program session covering the most of
 * the exercises actually logged. Derived rather than stored — the exercise
 * ids already say which day it was, so a set log needs no session field.
 * Null when nothing logged matches the program (a purely ad-hoc day).
 */
export function inferSession(exerciseIds) {
  const ids = new Set(exerciseIds)
  let best = null
  let bestHits = 0
  for (const session of SESSIONS) {
    const hits = session.exercises.filter((e) => ids.has(e.id)).length
    if (hits > bestHits) {
      best = session
      bestHits = hits
    }
  }
  return best
}

/** A day's totals, for the history list. */
export function sessionSummary(logs, date) {
  const sets = liveSets(logs).filter((l) => l.date === date)
  const exercises = [...new Set(sets.map((l) => l.exercise))]
  return {
    date,
    setCount: sets.length,
    volume: volumeOf(sets),
    exercises,
    session: inferSession(exercises),
  }
}

/** Sessions trained on or after `fromDate` — the "2 of 3 this week" counter. */
export const sessionCountSince = (logs, fromDate) =>
  sessionDates(logs).filter((d) => d >= fromDate).length

/** How a weight reads in the UI. 0 is bodyweight, not "zero pounds". */
export const formatWeight = (weight) =>
  weight == null ? '—' : weight === 0 ? 'BW' : `${weight} lb`
