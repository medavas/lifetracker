import { describe, it, expect } from 'vitest'
import {
  liveSets, setsOn, sessionDates, lastPerformance, workingWeight, nextTarget,
  volumeOf, topSetSeries, lineGeometry, inferSession, sessionSummary,
  sessionCountSince, formatWeight,
} from '../workout'
import { SESSIONS, ALL_EXERCISES, exerciseById, sessionForWeekday, stepFor } from '../../data/workoutProgram'

let seq = 0
const set = (exercise, date, weight, reps, extra = {}) => ({
  id: `l${++seq}`, itemId: null, areaId: 'fitness', kind: 'set',
  exercise, date, weight, reps, createdAt: seq, updatedAt: seq, deletedAt: null, ...extra,
})

const bench = exerciseById('smith-bench') // 3 x 6-10, step 5
const pullup = exerciseById('assisted-pullup') // 3 x 8-12, assisted
const splits = exerciseById('split-squat') // 2 x 10-10

describe('program config', () => {
  it('gives every exercise a unique, stable id', () => {
    const ids = ALL_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every exercise a workable rep range and set count', () => {
    for (const e of ALL_EXERCISES) {
      expect(e.low).toBeGreaterThan(0)
      expect(e.high).toBeGreaterThanOrEqual(e.low)
      expect(e.sets).toBeGreaterThan(0)
      expect(e.cue.length).toBeGreaterThan(0)
    }
  })

  it('schedules Saturday upper, Sunday lower, Wednesday full body', () => {
    expect(sessionForWeekday(6).id).toBe('upper')
    expect(sessionForWeekday(0).id).toBe('lower')
    expect(sessionForWeekday(3).id).toBe('full')
  })

  it('leaves the other four weekdays as rest days', () => {
    for (const dow of [1, 2, 4, 5]) expect(sessionForWeekday(dow)).toBeUndefined()
  })
})

describe('reading set logs', () => {
  const logs = [
    set('smith-bench', '2026-08-01', 135, 8),
    set('smith-bench', '2026-08-01', 135, 7),
    { ...set('smith-bench', '2026-08-01', 135, 6), deletedAt: 99 },
    set('lat-pulldown', '2026-08-01', 120, 10),
    { id: 'x', kind: 'habit-check', areaId: 'fitness', date: '2026-08-01', deletedAt: null },
  ]

  it('ignores tombstoned sets and every other log kind', () => {
    expect(liveSets(logs)).toHaveLength(3)
  })

  it('returns one exercise\'s sets for a date in logged order', () => {
    expect(setsOn(logs, 'smith-bench', '2026-08-01').map((s) => s.reps)).toEqual([8, 7])
  })

  it('lists session dates most recent first', () => {
    const more = [...logs, set('smith-squat', '2026-08-05', 185, 8)]
    expect(sessionDates(more)).toEqual(['2026-08-05', '2026-08-01'])
  })
})

describe('lastPerformance', () => {
  const logs = [
    set('smith-bench', '2026-07-25', 130, 10),
    set('smith-bench', '2026-08-01', 135, 8),
    set('smith-bench', '2026-08-01', 135, 7),
    set('smith-bench', '2026-08-08', 135, 9),
  ]

  it('finds the most recent earlier session, not the current one', () => {
    const last = lastPerformance(logs, 'smith-bench', '2026-08-08')
    expect(last.date).toBe('2026-08-01')
    expect(last.sets).toHaveLength(2)
  })

  it('is null for an exercise never trained before that date', () => {
    expect(lastPerformance(logs, 'smith-bench', '2026-07-25')).toBeNull()
    expect(lastPerformance(logs, 'pec-fly', '2026-08-08')).toBeNull()
  })
})

describe('workingWeight', () => {
  it('takes the heaviest weight, so a warm-up set cannot drag it down', () => {
    const sets = [{ weight: 95, reps: 10 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]
    expect(workingWeight(sets, bench)).toBe(135)
  })

  it('takes the LIGHTEST assist on an assisted machine, where less is stronger', () => {
    const sets = [{ weight: 80, reps: 10 }, { weight: 60, reps: 8 }]
    expect(workingWeight(sets, pullup)).toBe(60)
  })

  it('is null with no sets', () => {
    expect(workingWeight([], bench)).toBeNull()
  })
})

describe('nextTarget — double progression', () => {
  it('starts at the bottom of the range with no weight opinion', () => {
    expect(nextTarget(bench, null)).toEqual({ weight: null, reps: bench.low, advance: 'start' })
  })

  it('adds a rep to the weakest set while the range is not topped out', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 135, reps: 9 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 },
    ] }
    expect(nextTarget(bench, last)).toEqual({ weight: 135, reps: 8, advance: 'reps' })
  })

  it('adds weight and drops to the bottom once every set hits the top', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 },
    ] }
    expect(nextTarget(bench, last)).toEqual({
      weight: 135 + stepFor(bench), reps: bench.low, advance: 'weight',
    })
  })

  it('does not advance weight on topped-out reps across too few sets', () => {
    const last = { date: '2026-08-01', sets: [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }] }
    expect(nextTarget(bench, last).advance).toBe('reps')
  })

  it('never proposes more than the top of the range', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 9 },
    ] }
    expect(nextTarget(bench, last).reps).toBe(bench.high)
  })

  it('ignores sets at other weights when judging the working sets', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 95, reps: 12 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 },
    ] }
    expect(nextTarget(bench, last).weight).toBe(140)
  })

  it('removes assistance rather than adding it when an assisted machine tops out', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 60, reps: 12 }, { weight: 60, reps: 12 }, { weight: 60, reps: 12 },
    ] }
    expect(nextTarget(pullup, last)).toEqual({ weight: 55, reps: pullup.low, advance: 'weight' })
  })

  it('floors assistance at zero — an unassisted pull-up is the end of the ladder', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 0, reps: 12 }, { weight: 0, reps: 12 }, { weight: 0, reps: 12 },
    ] }
    expect(nextTarget(pullup, last).weight).toBe(0)
  })

  it('handles a fixed-rep exercise (low === high) by advancing weight every time it is met', () => {
    const last = { date: '2026-08-01', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }] }
    expect(nextTarget(splits, last)).toEqual({ weight: 45, reps: 10, advance: 'weight' })
  })
})

describe('volume and series', () => {
  const logs = [
    set('smith-bench', '2026-07-25', 130, 10),
    set('smith-bench', '2026-07-25', 130, 9),
    set('smith-bench', '2026-08-01', 95, 12),
    set('smith-bench', '2026-08-01', 135, 8),
    set('smith-bench', '2026-08-01', 135, 6),
  ]

  it('sums weight x reps, treating a missing weight as bodyweight', () => {
    expect(volumeOf([{ weight: 100, reps: 10 }, { reps: 5 }])).toBe(1000)
  })

  it('gives one chronological point per session at that session\'s working weight', () => {
    const series = topSetSeries(logs, bench)
    expect(series.map((p) => [p.date, p.weight, p.reps])).toEqual([
      ['2026-07-25', 130, 10],
      ['2026-08-01', 135, 8],
    ])
  })

  it('reports the whole session\'s set count and volume on each point', () => {
    const [, latest] = topSetSeries(logs, bench)
    expect(latest.sets).toBe(3)
    expect(latest.volume).toBe(95 * 12 + 135 * 8 + 135 * 6)
  })

  it('keeps only the most recent `limit` sessions', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      set('smith-bench', `2026-01-${String(i + 1).padStart(2, '0')}`, 100 + i, 8))
    const series = topSetSeries(many, bench, 5)
    expect(series).toHaveLength(5)
    expect(series[series.length - 1].date).toBe('2026-01-20')
  })
})

describe('lineGeometry', () => {
  const pts = [
    { date: 'a', weight: 100 }, { date: 'b', weight: 110 }, { date: 'c', weight: 120 },
  ]

  it('reports the true min and max so the non-zero baseline can be labelled', () => {
    const g = lineGeometry(pts, { width: 320, height: 100 })
    expect([g.min, g.max]).toEqual([100, 120])
  })

  it('puts the largest value highest — SVG y grows downward', () => {
    const g = lineGeometry(pts, { width: 320, height: 100 })
    expect(g.pts[2].y).toBeLessThan(g.pts[1].y)
    expect(g.pts[1].y).toBeLessThan(g.pts[0].y)
  })

  it('spans the full plot width, first point to last', () => {
    const g = lineGeometry(pts, { width: 320, height: 100, padX: 10 })
    expect(g.pts[0].x).toBe(10)
    expect(g.pts[2].x).toBe(310)
  })

  it('centers a single point instead of dividing by a zero span', () => {
    const g = lineGeometry([{ date: 'a', weight: 100 }], { width: 320, height: 100 })
    expect(g.pts[0]).toMatchObject({ x: 160, y: 50 })
  })

  it('centers a flat series rather than producing NaN', () => {
    const g = lineGeometry([{ weight: 100 }, { weight: 100 }], { height: 100 })
    for (const p of g.pts) expect(p.y).toBe(50)
  })

  it('emits a path that moves once and lines thereafter', () => {
    const g = lineGeometry(pts)
    expect(g.path.startsWith('M')).toBe(true)
    expect(g.path.match(/M/g)).toHaveLength(1)
    expect(g.path.match(/L/g)).toHaveLength(2)
  })

  it('survives an empty series', () => {
    expect(lineGeometry([])).toMatchObject({ pts: [], path: '', min: 0, max: 0 })
  })
})

describe('inferSession', () => {
  it('names the session covering the most of what was logged', () => {
    expect(inferSession(['smith-bench', 'lat-pulldown', 'pec-fly']).id).toBe('upper')
    expect(inferSession(['leg-press', 'smith-rdl']).id).toBe('lower')
    expect(inferSession(['smith-squat', 'lateral-raise']).id).toBe('full')
  })

  it('is null when nothing logged belongs to the program', () => {
    expect(inferSession(['kettlebell-swing'])).toBeNull()
    expect(inferSession([])).toBeNull()
  })
})

describe('sessionSummary and week count', () => {
  const logs = [
    set('smith-bench', '2026-08-01', 135, 8),
    set('lat-pulldown', '2026-08-01', 120, 10),
    set('leg-press', '2026-08-02', 270, 10),
  ]

  it('rolls a day up into sets, volume and the session it was', () => {
    const s = sessionSummary(logs, '2026-08-01')
    expect(s.setCount).toBe(2)
    expect(s.volume).toBe(135 * 8 + 120 * 10)
    expect(s.session.id).toBe('upper')
    expect(s.exercises).toEqual(['smith-bench', 'lat-pulldown'])
  })

  it('counts distinct training days from a week start, not individual sets', () => {
    expect(sessionCountSince(logs, '2026-08-01')).toBe(2)
    expect(sessionCountSince(logs, '2026-08-02')).toBe(1)
    expect(sessionCountSince(logs, '2026-08-03')).toBe(0)
  })
})

describe('formatWeight', () => {
  it('calls zero bodyweight, not zero pounds', () => {
    expect(formatWeight(0)).toBe('BW')
    expect(formatWeight(135)).toBe('135 lb')
    expect(formatWeight(null)).toBe('—')
  })
})

describe('every program session', () => {
  it('is reachable and internally consistent', () => {
    expect(SESSIONS.map((s) => s.id)).toEqual(['upper', 'lower', 'full'])
    for (const s of SESSIONS) {
      expect(s.exercises.length).toBeGreaterThan(0)
      for (const e of s.exercises) expect(exerciseById(e.id).name).toBe(e.name)
    }
  })
})
