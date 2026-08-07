import { describe, it, expect } from 'vitest'
import { monthKey, daysInMonth, addDays, advanceDue, monthlyize } from '../finance.js'

describe('date helpers', () => {
  it('monthKey takes the YYYY-MM prefix', () => {
    expect(monthKey('2026-08-06')).toBe('2026-08')
    expect(monthKey('2026-08')).toBe('2026-08')
  })

  it('daysInMonth handles length and leap years', () => {
    expect(daysInMonth('2026-01')).toBe(31)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-04')).toBe(30)
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-06', 14)).toBe('2026-08-20')
    expect(addDays('2026-08-25', 14)).toBe('2026-09-08')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('advanceDue', () => {
  it('monthly advances one month, clamped to month end', () => {
    expect(advanceDue('2026-08-15', 'monthly')).toBe('2026-09-15')
    expect(advanceDue('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceDue('2026-12-15', 'monthly')).toBe('2027-01-15')
  })

  it('yearly advances one year, clamping Feb 29', () => {
    expect(advanceDue('2026-03-01', 'yearly')).toBe('2027-03-01')
    expect(advanceDue('2028-02-29', 'yearly')).toBe('2029-02-28')
  })

  it('weekly advances seven days', () => {
    expect(advanceDue('2026-08-28', 'weekly')).toBe('2026-09-04')
  })
})

describe('monthlyize', () => {
  it('passes monthly through, divides yearly, scales weekly', () => {
    expect(monthlyize({ amount: 1500, cadence: 'monthly' })).toBe(1500)
    expect(monthlyize({ amount: 12000, cadence: 'yearly' })).toBe(1000)
    expect(monthlyize({ amount: 1000, cadence: 'weekly' })).toBe(4333)
  })

  it('defaults a missing cadence to monthly and a missing amount to 0', () => {
    expect(monthlyize({ amount: 900 })).toBe(900)
    expect(monthlyize({ cadence: 'monthly' })).toBe(0)
  })
})
