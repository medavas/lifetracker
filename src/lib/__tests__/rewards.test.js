import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computePoints, bandCounts, dailyActivity, startOfWeekKey, dailyPresence, habitStreak, QUARTER_WEEKS } from '../rewards.js'

const log = (over) => ({ id: Math.random().toString(), itemId: 'i', areaId: 'a', date: '2026-07-26', createdAt: 1, updatedAt: 1, deletedAt: null, ...over })

const note = (over) => ({ id: Math.random().toString(), areaId: 'journal', itemId: null, text: 't', createdAt: Date.parse('2026-08-04T09:00:00'), updatedAt: 1, deletedAt: null, ...over })

describe('computePoints', () => {
  it('is 0 for no logs', () => {
    expect(computePoints([])).toBe(0)
  })
  it('scores completes and habit-checks', () => {
    expect(computePoints([log({ kind: 'complete' }), log({ kind: 'habit-check' })])).toBe(15) // 10 + 5
  })
  it('counts each journal day once', () => {
    const logs = [
      log({ kind: 'journal', date: '2026-07-26' }),
      log({ kind: 'journal', date: '2026-07-26' }),
      log({ kind: 'journal', date: '2026-07-27' }),
    ]
    expect(computePoints(logs)).toBe(30) // two distinct days * 15
  })
  it('ignores tombstoned logs', () => {
    expect(computePoints([log({ kind: 'complete', deletedAt: 5 })])).toBe(0)
  })
})

describe('habitStreak', () => {
  it('does not count a tombstoned habit-check toward the streak', () => {
    const logs = [
      log({ itemId: 'h1', kind: 'habit-check', date: '2026-08-04', deletedAt: 5 }),
    ]
    expect(habitStreak(logs, 'h1')).toBe(0)
  })
})

describe('bandCounts', () => {
  const D = '2026-08-04'

  it('returns a zero for every band when nothing happened', () => {
    expect(bandCounts([], [], D)).toEqual({ journal: 0, diet: 0, fitness: 0, habits: 0, focus: 0 })
  })

  it('counts journal NOTEs, not the day-marker log', () => {
    const notes = [note({}), note({}), note({})]
    const logs = [log({ kind: 'journal', areaId: 'journal', date: D })]
    expect(bandCounts(logs, notes, D).journal).toBe(3)
  })

  it('ignores per-item notes and notes from other areas', () => {
    const notes = [
      note({ itemId: 'i1' }),
      note({ areaId: 'fitness' }),
      note({}),
    ]
    expect(bandCounts([], notes, D).journal).toBe(1)
  })

  it('counts completes per area without cross-contamination', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: D }),
      log({ kind: 'complete', areaId: 'diet', date: D }),
      log({ kind: 'complete', areaId: 'fitness', date: D }),
      log({ kind: 'complete', areaId: 'finance', date: D }),
    ]
    const b = bandCounts(logs, [], D)
    expect(b.diet).toBe(2)
    expect(b.fitness).toBe(1)
  })

  it('counts habit-checks into the habits band', () => {
    const logs = [
      log({ kind: 'habit-check', areaId: 'habits', date: D }),
      log({ kind: 'habit-check', areaId: 'habits', date: D }),
    ]
    expect(bandCounts(logs, [], D).habits).toBe(2)
  })

  it('excludes tombstoned logs and notes', () => {
    const logs = [log({ kind: 'complete', areaId: 'diet', date: D, deletedAt: 5 })]
    const notes = [note({ deletedAt: 5 })]
    const b = bandCounts(logs, notes, D)
    expect(b.diet).toBe(0)
    expect(b.journal).toBe(0)
  })

  it('buckets notes by local day, matching log date keys', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T23:30:00') })]
    expect(bandCounts([], notes, D).journal).toBe(1)
    expect(bandCounts([], notes, '2026-08-05').journal).toBe(0)
  })

  it('counts habit-checks into a non-habits-kind band (the top-priorities case)', () => {
    const logs = [
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
    ]
    expect(bandCounts(logs, [], D).fitness).toBe(2)
  })

  it('sums completes and habit-checks in the same area on the same day', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
    ]
    expect(bandCounts(logs, [], D).fitness).toBe(3)
  })

  it('counts completes into the focus band with no dedicated code path (5th-band claim)', () => {
    const logs = [log({ kind: 'complete', areaId: 'focus', date: D })]
    expect(bandCounts(logs, [], D).focus).toBe(1)
  })
})

describe('dailyActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns n days oldest-first ending today', () => {
    const out = dailyActivity([], [], 7)
    expect(out).toHaveLength(7)
    expect(out[0].date).toBe('2026-07-29')
    expect(out[6].date).toBe('2026-08-04')
  })

  it('includes zero days rather than skipping them', () => {
    const out = dailyActivity([log({ kind: 'complete', areaId: 'diet', date: '2026-08-04' })], [], 7)
    expect(out).toHaveLength(7)
    expect(out[0]).toEqual({ date: '2026-07-29', bands: { journal: 0, diet: 0, fitness: 0, habits: 0, focus: 0 }, total: 0 })
  })

  it('sums the four bands into total', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-04' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-04' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-04' }),
    ]
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    const today = dailyActivity(logs, notes, 7)[6]
    expect(today.bands).toEqual({ journal: 1, diet: 1, fitness: 0, habits: 2, focus: 0 })
    expect(today.total).toBe(4)
  })

  it('ignores activity in non-daily areas', () => {
    const logs = [log({ kind: 'complete', areaId: 'finance', date: '2026-08-04' })]
    expect(dailyActivity(logs, [], 7)[6].total).toBe(0)
  })

  it('keeps each day isolated when multiple days have activity (indexing path)', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-01' }),
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-01' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-02' }),
      log({ kind: 'complete', areaId: 'fitness', date: '2026-08-03' }),
    ]
    const notes = [
      note({ createdAt: Date.parse('2026-08-01T08:00:00') }),
      note({ createdAt: Date.parse('2026-08-04T08:00:00') }),
    ]
    const out = dailyActivity(logs, notes, 7)
    const byDate = Object.fromEntries(out.map((d) => [d.date, d.bands]))
    expect(byDate['2026-08-01']).toEqual({ journal: 1, diet: 2, fitness: 0, habits: 0, focus: 0 })
    expect(byDate['2026-08-02']).toEqual({ journal: 0, diet: 0, fitness: 0, habits: 1, focus: 0 })
    expect(byDate['2026-08-03']).toEqual({ journal: 0, diet: 0, fitness: 1, habits: 0, focus: 0 })
    expect(byDate['2026-08-04']).toEqual({ journal: 1, diet: 0, fitness: 0, habits: 0, focus: 0 })
  })
})

describe('startOfWeekKey', () => {
  it('returns the same day for a Monday', () => {
    expect(startOfWeekKey(new Date('2026-08-03T12:00:00'))).toBe('2026-08-03')
  })
  it('walks back to Monday from midweek', () => {
    expect(startOfWeekKey(new Date('2026-08-04T12:00:00'))).toBe('2026-08-03')
  })
  it('treats Sunday as the end of its week, not the start', () => {
    expect(startOfWeekKey(new Date('2026-08-09T12:00:00'))).toBe('2026-08-03')
  })
})

describe('dailyPresence', () => {
  // 2026-08-04 is a Tuesday; its week starts Mon 2026-08-03.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns exactly 5 weeks of 7 days', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid).toHaveLength(5)
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it('starts four Mondays back and ends on the current week Sunday', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid[0][0].date).toBe('2026-07-06')
    expect(grid[4][0].date).toBe('2026-08-03')
    expect(grid[4][6].date).toBe('2026-08-09')
  })

  it('spans exactly 91 distinct days over the quarter window', () => {
    const grid = dailyPresence([], [], QUARTER_WEEKS)
    expect(grid).toHaveLength(13)
    const dates = grid.flat().map((c) => c.date)
    expect(dates).toHaveLength(91)
    expect(new Set(dates).size).toBe(91)
    expect(dates[0]).toBe('2026-05-11') // twelve Mondays back
    expect(dates[90]).toBe('2026-08-09') // this week's Sunday
  })

  it('stays 91 days across a year boundary out of a 53-week ISO year', () => {
    // The drift that sinks fixed 13-week quarters: 2026 is a 53-week ISO year,
    // so a fiscal-quarter grid would have to swallow a correction week here.
    // A window measured back from today just does not have the problem.
    vi.setSystemTime(new Date('2027-01-06T12:00:00')) // Wed of the week of Mon 2027-01-04
    const dates = dailyPresence([], [], QUARTER_WEEKS).flat().map((c) => c.date)
    expect(dates).toHaveLength(91)
    expect(dates[0]).toBe('2026-10-12')
    expect(dates[90]).toBe('2027-01-10')
    expect((Date.parse(dates[90]) - Date.parse(dates[0])) / 86400000).toBe(90)
  })

  it('flags days after today as future', () => {
    const grid = dailyPresence([], [], 5)
    expect(grid[4][0].future).toBe(false) // Mon 08-03
    expect(grid[4][1].future).toBe(false) // Tue 08-04, today
    expect(grid[4][2].future).toBe(true)  // Wed 08-05
    expect(grid[0][0].future).toBe(false)
  })

  it('thresholds counts to booleans', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-03' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-03' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-08-03' }),
    ]
    const cell = dailyPresence(logs, [], 5)[4][0]
    expect(cell.bands).toEqual({ journal: false, diet: true, fitness: false, habits: true, focus: false })
  })

  it('puts a Sunday and the following Monday in different weeks', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-02' }), // Sunday
      log({ kind: 'complete', areaId: 'diet', date: '2026-08-03' }), // Monday
    ]
    const grid = dailyPresence(logs, [], 5)
    expect(grid[3][6].date).toBe('2026-08-02')
    expect(grid[3][6].bands.diet).toBe(true)
    expect(grid[4][0].bands.diet).toBe(true)
    expect(grid[3][0].bands.diet).toBe(false)
  })

  it('excludes tombstoned records', () => {
    const logs = [log({ kind: 'complete', areaId: 'diet', date: '2026-08-03', deletedAt: 5 })]
    expect(dailyPresence(logs, [], 5)[4][0].bands.diet).toBe(false)
  })

  it('does not bleed activity across days when multiple days are touched (indexing path)', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'diet', date: '2026-07-20' }),
      log({ kind: 'habit-check', areaId: 'habits', date: '2026-07-27' }),
      log({ kind: 'complete', areaId: 'fitness', date: '2026-08-03' }),
    ]
    const notes = [note({ createdAt: Date.parse('2026-08-04T08:00:00') })]
    const grid = dailyPresence(logs, notes, 5)
    const byDate = Object.fromEntries(grid.flat().map((c) => [c.date, c.bands]))
    expect(byDate['2026-07-20']).toEqual({ journal: false, diet: true, fitness: false, habits: false, focus: false })
    expect(byDate['2026-07-27']).toEqual({ journal: false, diet: false, fitness: false, habits: true, focus: false })
    expect(byDate['2026-08-03']).toEqual({ journal: false, diet: false, fitness: true, habits: false, focus: false })
    expect(byDate['2026-08-04']).toEqual({ journal: true, diet: false, fitness: false, habits: false, focus: false })
  })
})
