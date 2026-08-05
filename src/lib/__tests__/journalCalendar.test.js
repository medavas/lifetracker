import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { yearsWithEntries, monthEntryFlags, daysInMonth, entriesForDay } from '../journalCalendar.js'

const note = (over) => ({
  id: Math.random().toString(), areaId: 'journal', itemId: null, text: 't',
  createdAt: Date.parse('2026-08-04T09:00:00'), updatedAt: 1, deletedAt: null, ...over,
})

describe('yearsWithEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('always includes the current year, even with zero entries', () => {
    expect(yearsWithEntries([])).toEqual(['2026'])
  })

  it('collects distinct years from entries, ascending, deduped', () => {
    const notes = [
      note({ createdAt: Date.parse('2024-03-01T10:00:00') }),
      note({ createdAt: Date.parse('2025-11-20T10:00:00') }),
      note({ createdAt: Date.parse('2024-06-15T10:00:00') }),
    ]
    expect(yearsWithEntries(notes)).toEqual(['2024', '2025', '2026'])
  })

  it('ignores tombstoned notes, per-item notes, and non-journal notes', () => {
    const notes = [
      note({ createdAt: Date.parse('2020-01-01T10:00:00'), deletedAt: 5 }),
      note({ createdAt: Date.parse('2021-01-01T10:00:00'), itemId: 'i1' }),
      note({ createdAt: Date.parse('2022-01-01T10:00:00'), areaId: 'fitness' }),
    ]
    expect(yearsWithEntries(notes)).toEqual(['2026'])
  })
})

describe('monthEntryFlags', () => {
  it('marks only the months with a live entry in that year', () => {
    const notes = [
      note({ createdAt: Date.parse('2026-01-15T10:00:00') }),
      note({ createdAt: Date.parse('2026-08-04T10:00:00') }),
    ]
    const flags = monthEntryFlags(notes, '2026')
    expect(flags).toHaveLength(12)
    expect(flags[0]).toBe(true) // January
    expect(flags[7]).toBe(true) // August
    expect(flags[1]).toBe(false) // February
  })

  it('does not let a December entry leak into the following January', () => {
    const notes = [note({ createdAt: Date.parse('2026-12-31T23:00:00') })]
    expect(monthEntryFlags(notes, '2027')[0]).toBe(false)
    expect(monthEntryFlags(notes, '2026')[11]).toBe(true)
  })

  it('returns all-false for a year with no entries', () => {
    expect(monthEntryFlags([], '2019')).toEqual(new Array(12).fill(false))
  })
})

describe('daysInMonth', () => {
  it('sizes the array to the month\'s real day count', () => {
    expect(daysInMonth([], '2026', 8)).toHaveLength(31) // August
    expect(daysInMonth([], '2026', 4)).toHaveLength(30) // April
    expect(daysInMonth([], '2026', 2)).toHaveLength(28) // February, non-leap
    expect(daysInMonth([], '2028', 2)).toHaveLength(29) // February, leap year
  })

  it('marks the correct day index for an entry', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    const flags = daysInMonth(notes, '2026', 8)
    expect(flags[3]).toBe(true) // the 4th, index 3
    expect(flags[0]).toBe(false)
  })

  it('marks the last day of a leap-year February correctly', () => {
    const notes = [note({ createdAt: Date.parse('2028-02-29T10:00:00') })]
    const flags = daysInMonth(notes, '2028', 2)
    expect(flags).toHaveLength(29)
    expect(flags[28]).toBe(true)
  })

  it('accepts month as a string, matching a route param', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    expect(daysInMonth(notes, '2026', '8')[3]).toBe(true)
  })
})

describe('entriesForDay', () => {
  it('returns only entries on that exact day, chronologically', () => {
    const notes = [
      note({ id: 'b', createdAt: Date.parse('2026-08-04T18:00:00'), text: 'evening' }),
      note({ id: 'a', createdAt: Date.parse('2026-08-04T08:00:00'), text: 'morning' }),
      note({ id: 'c', createdAt: Date.parse('2026-08-05T08:00:00'), text: 'next day' }),
    ]
    const entries = entriesForDay(notes, '2026', 8, 4)
    expect(entries.map((n) => n.text)).toEqual(['morning', 'evening'])
  })

  it('returns an empty array for a day with no entries', () => {
    expect(entriesForDay([], '2026', 8, 4)).toEqual([])
  })

  it('excludes tombstoned and per-item notes on the same day', () => {
    const notes = [
      note({ createdAt: Date.parse('2026-08-04T09:00:00'), deletedAt: 5 }),
      note({ createdAt: Date.parse('2026-08-04T09:00:00'), itemId: 'i1' }),
    ]
    expect(entriesForDay(notes, '2026', 8, 4)).toEqual([])
  })

  it('accepts day and month as strings, matching route params', () => {
    const notes = [note({ createdAt: Date.parse('2026-08-04T09:00:00') })]
    expect(entriesForDay(notes, '2026', '8', '4')).toHaveLength(1)
  })
})
