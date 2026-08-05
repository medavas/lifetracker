import { describe, it, expect } from 'vitest'
import { DEFAULT_QUIET, inQuietHours, tickPlan, nextFireAt } from '../timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }

/** Epoch ms for a local wall-clock time today, so quiet-hours tests are TZ-safe. */
const at = (h, m = 0) => {
  const d = new Date(2026, 7, 4, h, m, 0, 0)
  return d.getTime()
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })

describe('inQuietHours', () => {
  it('is false when quiet hours are switched off', () => {
    expect(inQuietHours(at(2), OFF)).toBe(false)
  })

  it('treats the default window as wrapping midnight', () => {
    expect(DEFAULT_QUIET).toEqual({ on: true, startMin: 23 * 60, endMin: 7 * 60 })
    expect(inQuietHours(at(23, 30), DEFAULT_QUIET)).toBe(true)
    expect(inQuietHours(at(3), DEFAULT_QUIET)).toBe(true)
    expect(inQuietHours(at(6, 59), DEFAULT_QUIET)).toBe(true)
  })

  it('excludes waking hours from the default window', () => {
    expect(inQuietHours(at(7), DEFAULT_QUIET)).toBe(false)
    expect(inQuietHours(at(12), DEFAULT_QUIET)).toBe(false)
    expect(inQuietHours(at(22, 59), DEFAULT_QUIET)).toBe(false)
  })

  it('handles a same-day window that does not wrap', () => {
    const nap = { on: true, startMin: 13 * 60, endMin: 14 * 60 }
    expect(inQuietHours(at(13, 30), nap)).toBe(true)
    expect(inQuietHours(at(12, 59), nap)).toBe(false)
    expect(inQuietHours(at(14), nap)).toBe(false)
  })

  it('is false for missing quiet config', () => {
    expect(inQuietHours(at(2), undefined)).toBe(false)
  })
})

describe('tickPlan', () => {
  it('fires a nudge whose interval has elapsed and resets its anchor', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], { a: now - 45 * MIN }, OFF, now)
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('does not fire inside the interval', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], { a: now - 44 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('never fires a disabled nudge', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45, false)], { a: now - 99 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('never fires a nudge with no anchor, seeding it on first sighting instead', () => {
    const now = at(12)
    const plan = tickPlan([nudge('a', 45)], {}, OFF, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('a newly-seeded anchor does not fire on the same tick but does one interval later', () => {
    const seedNow = at(12)
    // A synced `enabled:true` with no local lastFired entry (e.g. toggled on
    // from another device) must self-heal by seeding here, not stay dead
    // forever -- see nudge-timers final review finding #1.
    const seeded = tickPlan([nudge('a', 45)], {}, OFF, seedNow)
    expect(seeded.fire).toEqual([])
    expect(seeded.anchors).toEqual({ a: seedNow })

    const lastFired = { ...seeded.anchors }
    const tooSoon = tickPlan([nudge('a', 45)], lastFired, OFF, seedNow + 44 * MIN)
    expect(tooSoon.fire).toEqual([])
    expect(tooSoon.anchors).toEqual({})

    const dueNow = seedNow + 45 * MIN
    const due = tickPlan([nudge('a', 45)], lastFired, OFF, dueNow)
    expect(due.fire).toEqual(['a'])
    expect(due.anchors).toEqual({ a: dueNow })
  })

  it('ignores a nudge with a missing or zero interval', () => {
    const now = at(12)
    const bad = [{ id: 'a', title: 'x', enabled: true }, nudge('b', 0)]
    const plan = tickPlan(bad, { a: now - 99 * MIN, b: now - 99 * MIN }, OFF, now)
    expect(plan.fire).toEqual([])
  })

  it('fires once when many intervals are overdue, never a burst', () => {
    const now = at(12)
    // Offset is NOT an exact multiple of the interval so this assertion can
    // tell "reset to now" apart from "advanced by 8 intervals" -- both would
    // land on the same anchors:{a:now} if the overdue amount were exact.
    const plan = tickPlan([nudge('a', 45)], { a: now - (8 * 45 * MIN + 10 * MIN) }, OFF, now)
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('suppresses firing during quiet hours but still advances the anchor', () => {
    const now = at(3)
    const plan = tickPlan([nudge('a', 45)], { a: now - 90 * MIN }, DEFAULT_QUIET, now)
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('handles several nudges independently in one tick', () => {
    const now = at(12)
    const plan = tickPlan(
      [nudge('a', 45), nudge('b', 120), nudge('c', 30)],
      { a: now - 46 * MIN, b: now - 10 * MIN, c: now - 30 * MIN },
      OFF,
      now,
    )
    expect(plan.fire.sort()).toEqual(['a', 'c'])
    expect(plan.anchors).toEqual({ a: now, c: now })
  })

  it('returns empty plans for an empty nudge list', () => {
    expect(tickPlan([], {}, OFF, at(12))).toEqual({ fire: [], anchors: {} })
  })
})

describe('nextFireAt', () => {
  it('is one interval past the anchor', () => {
    const anchor = at(12)
    expect(nextFireAt(nudge('a', 45), { a: anchor })).toBe(anchor + 45 * MIN)
  })

  it('is null for a disabled nudge or one with no anchor', () => {
    expect(nextFireAt(nudge('a', 45, false), { a: at(12) })).toBeNull()
    expect(nextFireAt(nudge('a', 45), {})).toBeNull()
  })
})
