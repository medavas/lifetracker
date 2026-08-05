import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Navigate } from 'react-router-dom'
import Journal from '../Journal'

describe('Journal redirect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('redirects to the current month\'s day list', () => {
    const el = Journal()
    expect(el.type).toBe(Navigate)
    expect(el.props.to).toBe('/journal/years/2026/8')
    expect(el.props.replace).toBe(true)
  })

  it('tracks a December boundary correctly', () => {
    vi.setSystemTime(new Date('2026-12-25T12:00:00'))
    const el = Journal()
    expect(el.props.to).toBe('/journal/years/2026/12')
  })

  it('tracks a January boundary into the new year correctly', () => {
    vi.setSystemTime(new Date('2027-01-03T12:00:00'))
    const el = Journal()
    expect(el.props.to).toBe('/journal/years/2027/1')
  })
})
