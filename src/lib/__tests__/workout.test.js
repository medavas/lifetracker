import { describe, it, expect } from 'vitest'
import {
  liveSets, setsOn, sessionDates, lastPerformance, workingWeight, nextTarget,
  volumeOf, topSetSeries, lineGeometry, sessionSummary, sessionCountSince,
  formatWeight, formatTarget, buildExerciseIndex, isAssisted,
} from '../workout'
import {
  DEFAULT_PROGRAM, EXERCISE_DEFAULTS, exerciseSpec, SESSION_BUCKET, WEEKDAYS,
} from '../../data/workoutProgram'

let seq = 0
const set = (itemId, date, weight, reps, extra = {}) => ({
  id: `l${++seq}`, itemId, areaId: 'fitness', kind: 'set',
  date, weight, reps, createdAt: seq, updatedAt: seq, deletedAt: null, ...extra,
})

const session = (id, title, weekday) => ({
  id, areaId: 'fitness', bucket: SESSION_BUCKET, title, weekday,
  status: 'open', order: 1, deletedAt: null,
})

const exercise = (id, parentId, spec = {}) => ({
  id, areaId: 'fitness', parentId, title: id, status: 'open', order: 1, deletedAt: null,
  sets: 3, low: 6, high: 10, step: 5, ...spec,
})

const bench = exercise('bench', 'upper')
const pullup = exercise('pullup', 'full', { sets: 3, low: 8, high: 12, step: -5 })
const splits = exercise('splits', 'full', { sets: 2, low: 10, high: 10, step: 5 })

describe('exercise spec', () => {
  it('defaults every missing field, so a hand-typed exercise still works', () => {
    expect(exerciseSpec({ title: 'Dips' })).toEqual(EXERCISE_DEFAULTS)
  })

  it('keeps the fields an exercise does define', () => {
    expect(exerciseSpec({ sets: 5, low: 3 })).toEqual({ ...EXERCISE_DEFAULTS, sets: 5, low: 3 })
  })

  it('treats a negative step as an assistance machine and nothing else as one', () => {
    expect(isAssisted(pullup)).toBe(true)
    expect(isAssisted(bench)).toBe(false)
    expect(isAssisted({})).toBe(false)
  })

  it('renders the target the way the row reads it', () => {
    expect(formatTarget(bench)).toBe('3 × 6–10')
    expect(formatTarget(splits)).toBe('2 × 10')
    expect(formatTarget({})).toBe('3 × 8–12')
  })
})

describe('the seed program', () => {
  it('is three days on distinct weekdays', () => {
    expect(DEFAULT_PROGRAM).toHaveLength(3)
    const days = DEFAULT_PROGRAM.map((s) => s.weekday)
    expect(new Set(days).size).toBe(3)
    for (const d of days) expect(WEEKDAYS[d]).toBeDefined()
  })

  it('gives every seeded exercise a workable spec', () => {
    for (const s of DEFAULT_PROGRAM) {
      expect(s.exercises.length).toBeGreaterThan(0)
      for (const e of s.exercises) {
        expect(e.title.length).toBeGreaterThan(0)
        expect(e.sets).toBeGreaterThan(0)
        expect(e.high).toBeGreaterThanOrEqual(e.low)
        expect(e.low).toBeGreaterThan(0)
        expect(e.details.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('buildExerciseIndex', () => {
  const items = [
    session('upper', 'Upper Body', 6),
    exercise('bench', 'upper'),
    { ...exercise('fly', 'upper'), status: 'archived' },
    { ...exercise('gone', 'upper'), deletedAt: 5 },
    exercise('orphan', 'not-a-session'),
    { id: 'tracking', areaId: 'fitness', bucket: 'PRs', title: 'Bench 185', status: 'open', deletedAt: null },
  ]

  it('indexes every exercise hanging off a real session', () => {
    expect([...buildExerciseIndex(items).keys()].sort()).toEqual(['bench', 'fly'])
  })

  it('keeps retired exercises, because their logged sets still happened', () => {
    expect(buildExerciseIndex(items).get('fly').status).toBe('archived')
  })

  it('excludes tombstoned exercises, plain tracking items and orphans', () => {
    const index = buildExerciseIndex(items)
    expect(index.has('gone')).toBe(false)
    expect(index.has('tracking')).toBe(false)
    expect(index.has('orphan')).toBe(false)
  })
})

describe('reading set logs', () => {
  const logs = [
    set('bench', '2026-08-01', 135, 8),
    set('bench', '2026-08-01', 135, 7),
    { ...set('bench', '2026-08-01', 135, 6), deletedAt: 99 },
    set('pulldown', '2026-08-01', 120, 10),
    { id: 'x', kind: 'habit-check', areaId: 'fitness', date: '2026-08-01', deletedAt: null },
  ]

  it('ignores tombstoned sets and every other log kind', () => {
    expect(liveSets(logs)).toHaveLength(3)
  })

  it('returns one exercise\'s sets for a date in logged order', () => {
    expect(setsOn(logs, 'bench', '2026-08-01').map((s) => s.reps)).toEqual([8, 7])
  })

  it('lists session dates most recent first', () => {
    const more = [...logs, set('squat', '2026-08-05', 185, 8)]
    expect(sessionDates(more)).toEqual(['2026-08-05', '2026-08-01'])
  })
})

describe('lastPerformance', () => {
  const logs = [
    set('bench', '2026-07-25', 130, 10),
    set('bench', '2026-08-01', 135, 8),
    set('bench', '2026-08-01', 135, 7),
    set('bench', '2026-08-08', 135, 9),
  ]

  it('finds the most recent earlier session, not the current one', () => {
    const last = lastPerformance(logs, 'bench', '2026-08-08')
    expect(last.date).toBe('2026-08-01')
    expect(last.sets).toHaveLength(2)
  })

  it('is null for an exercise never trained before that date', () => {
    expect(lastPerformance(logs, 'bench', '2026-07-25')).toBeNull()
    expect(lastPerformance(logs, 'fly', '2026-08-08')).toBeNull()
  })
})

describe('workingWeight', () => {
  it('takes the heaviest weight, so a warm-up set cannot drag it down', () => {
    const sets = [{ weight: 95, reps: 10 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]
    expect(workingWeight(sets, bench)).toBe(135)
  })

  it('takes the LIGHTEST assist on an assistance machine, where less is stronger', () => {
    const sets = [{ weight: 80, reps: 10 }, { weight: 60, reps: 8 }]
    expect(workingWeight(sets, pullup)).toBe(60)
  })

  it('is null with no sets', () => {
    expect(workingWeight([], bench)).toBeNull()
  })
})

describe('nextTarget — double progression', () => {
  it('starts at the bottom of the range with no weight opinion', () => {
    expect(nextTarget(bench, null)).toEqual({ weight: null, reps: 6, advance: 'start' })
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
    expect(nextTarget(bench, last)).toEqual({ weight: 140, reps: 6, advance: 'weight' })
  })

  it('honors an edited step instead of assuming 5 lb', () => {
    const legPress = exercise('legpress', 'lower', { sets: 1, low: 8, high: 10, step: 25 })
    const last = { date: '2026-08-01', sets: [{ weight: 300, reps: 10 }] }
    expect(nextTarget(legPress, last).weight).toBe(325)
  })

  it('uses the defaults for an exercise the user typed in with no numbers', () => {
    const plain = { id: 'dips', title: 'Dips' }
    const last = { date: '2026-08-01', sets: [
      { weight: 0, reps: 12 }, { weight: 0, reps: 12 }, { weight: 0, reps: 12 },
    ] }
    expect(nextTarget(plain, last)).toEqual({ weight: 5, reps: 8, advance: 'weight' })
  })

  it('does not advance weight on topped-out reps across too few sets', () => {
    const last = { date: '2026-08-01', sets: [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }] }
    expect(nextTarget(bench, last).advance).toBe('reps')
  })

  it('never proposes more than the top of the range', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 9 },
    ] }
    expect(nextTarget(bench, last).reps).toBe(10)
  })

  it('ignores sets at other weights when judging the working sets', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 95, reps: 12 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 },
    ] }
    expect(nextTarget(bench, last).weight).toBe(140)
  })

  it('removes assistance rather than adding it when an assistance machine tops out', () => {
    const last = { date: '2026-08-01', sets: [
      { weight: 60, reps: 12 }, { weight: 60, reps: 12 }, { weight: 60, reps: 12 },
    ] }
    expect(nextTarget(pullup, last)).toEqual({ weight: 55, reps: 8, advance: 'weight' })
  })

  it('floors assistance at zero — an unassisted rep is the end of the ladder', () => {
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
    set('bench', '2026-07-25', 130, 10),
    set('bench', '2026-07-25', 130, 9),
    set('bench', '2026-08-01', 95, 12),
    set('bench', '2026-08-01', 135, 8),
    set('bench', '2026-08-01', 135, 6),
  ]

  it('sums weight x reps, treating a missing weight as bodyweight', () => {
    expect(volumeOf([{ weight: 100, reps: 10 }, { reps: 5 }])).toBe(1000)
  })

  it('gives one chronological point per session at that session\'s working weight', () => {
    expect(topSetSeries(logs, bench).map((p) => [p.date, p.weight, p.reps])).toEqual([
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
      set('bench', `2026-01-${String(i + 1).padStart(2, '0')}`, 100 + i, 8))
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

describe('sessionSummary', () => {
  const index = buildExerciseIndex([
    session('upper', 'Upper Body', 6),
    session('lower', 'Lower Body', 0),
    exercise('bench', 'upper'),
    exercise('pulldown', 'upper'),
    { ...exercise('fly', 'upper'), status: 'archived' },
    exercise('legpress', 'lower'),
  ])
  const logs = [
    set('bench', '2026-08-01', 135, 8),
    set('pulldown', '2026-08-01', 120, 10),
    set('legpress', '2026-08-02', 270, 10),
  ]

  it('rolls a day up into sets, volume and the session it belonged to', () => {
    const s = sessionSummary(logs, index, '2026-08-01')
    expect(s.setCount).toBe(2)
    expect(s.volume).toBe(135 * 8 + 120 * 10)
    expect(s.sessionId).toBe('upper')
    expect(s.exercises).toEqual(['bench', 'pulldown'])
  })

  it('names the session covering the most of what was logged', () => {
    const mixed = [...logs, set('legpress', '2026-08-01', 270, 10)]
    expect(sessionSummary(mixed, index, '2026-08-01').sessionId).toBe('upper')
  })

  it('still attributes a day trained on a since-retired exercise', () => {
    expect(sessionSummary([set('fly', '2026-08-03', 85, 12)], index, '2026-08-03').sessionId).toBe('upper')
  })

  it('leaves the session null when nothing logged resolves to one', () => {
    const s = sessionSummary([set('ghost', '2026-08-04', 50, 10)], index, '2026-08-04')
    expect(s.sessionId).toBeNull()
    expect(s.setCount).toBe(1)
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
