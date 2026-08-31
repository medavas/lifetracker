import { describe, it, expect } from 'vitest'
import {
  DEFAULT_QUIET, inQuietHours, tickPlan, nextFireAt,
  dailyPlan, nextDailyFireAt, wakingMinutes, shuffle, philosophyPlan, nextPhilosophyFireAt,
} from '../timers.js'

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

/** Epoch ms for a local wall-clock time on a given day-of-month, for crossing-midnight tests. */
const atDay = (day, h, m = 0) => new Date(2026, 7, day, h, m, 0, 0).getTime()

const daily = (id, timeMin, enabled = true) => ({ id, title: `${id} message`, timeMin, enabled })

describe('dailyPlan', () => {
  it('does not fire before its time today', () => {
    const plan = dailyPlan([daily('a', 6 * 60 + 30)], {}, atDay(4, 6, 0))
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('fires once the clock crosses its time, with no prior anchor', () => {
    const now = atDay(4, 6, 30)
    const plan = dailyPlan([daily('a', 6 * 60 + 30)], {}, now)
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: now })
  })

  it('does not re-fire later the same day once it has fired', () => {
    const firedAt = atDay(4, 6, 30)
    const plan = dailyPlan([daily('a', 6 * 60 + 30)], { a: firedAt }, atDay(4, 20, 0))
    expect(plan.fire).toEqual([])
    expect(plan.anchors).toEqual({})
  })

  it('fires again the next day', () => {
    const firedYesterday = atDay(4, 6, 30)
    const plan = dailyPlan([daily('a', 6 * 60 + 30)], { a: firedYesterday }, atDay(5, 6, 30))
    expect(plan.fire).toEqual(['a'])
    expect(plan.anchors).toEqual({ a: atDay(5, 6, 30) })
  })

  it('catches up once if the app was closed at the scheduled time and opens later the same day', () => {
    const plan = dailyPlan([daily('a', 6 * 60 + 30)], {}, atDay(4, 9, 0))
    expect(plan.fire).toEqual(['a'])
  })

  it('never fires a disabled daily nudge', () => {
    const plan = dailyPlan([daily('a', 6 * 60 + 30, false)], {}, atDay(4, 9, 0))
    expect(plan.fire).toEqual([])
  })

  it('ignores an interval-mode nudge (no timeMin)', () => {
    const plan = dailyPlan([nudge('a', 45)], {}, atDay(4, 9, 0))
    expect(plan.fire).toEqual([])
  })

  it('fires regardless of quiet hours -- a scheduled clock-time reminder is a deliberate alarm', () => {
    // 22:30 falls inside the default 23:00-07:00 quiet window's complement check
    // is irrelevant here: dailyPlan takes no quiet argument at all.
    const plan = dailyPlan([daily('a', 23 * 60 + 30)], {}, atDay(4, 23, 30))
    expect(plan.fire).toEqual(['a'])
  })
})

describe('nextDailyFireAt', () => {
  it("is today's time when not yet fired today, even if already overdue", () => {
    const now = atDay(4, 9, 0)
    expect(nextDailyFireAt(daily('a', 6 * 60 + 30), {}, now)).toBe(atDay(4, 6, 30))
  })

  it("is tomorrow's time once today's has fired", () => {
    const now = atDay(4, 9, 0)
    const firedToday = atDay(4, 6, 30)
    expect(nextDailyFireAt(daily('a', 6 * 60 + 30), { a: firedToday }, now)).toBe(atDay(5, 6, 30))
  })

  it('is null for a disabled nudge or one with no timeMin', () => {
    expect(nextDailyFireAt(daily('a', 60, false), {}, atDay(4, 9))).toBeNull()
    expect(nextDailyFireAt(nudge('a', 45), {}, atDay(4, 9))).toBeNull()
  })
})

describe('wakingMinutes', () => {
  it('is the full day when quiet hours are off', () => {
    expect(wakingMinutes(OFF)).toBe(24 * 60)
  })

  it('subtracts a midnight-wrapping quiet window', () => {
    expect(wakingMinutes(DEFAULT_QUIET)).toBe(24 * 60 - 8 * 60)
  })

  it('subtracts a same-day quiet window', () => {
    expect(wakingMinutes({ on: true, startMin: 13 * 60, endMin: 14 * 60 })).toBe(24 * 60 - 60)
  })
})

describe('shuffle', () => {
  it('returns a permutation of the same ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const result = shuffle(ids)
    expect(result).toHaveLength(ids.length)
    expect([...result].sort()).toEqual([...ids].sort())
  })

  it('does not mutate its input', () => {
    const ids = ['a', 'b', 'c']
    shuffle(ids)
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

describe('philosophyPlan', () => {
  it('seeds an order and anchor on first sighting instead of firing', () => {
    const now = at(12)
    const plan = philosophyPlan(['a', 'b'], {}, OFF, now)
    expect(plan.fire).toBeNull()
    expect(plan.state.order.sort()).toEqual(['a', 'b'])
    expect(plan.state.index).toBe(0)
    expect(plan.state.anchor).toBe(now)
  })

  it('does nothing when no items are enabled', () => {
    const plan = philosophyPlan([], {}, OFF, at(12))
    expect(plan.fire).toBeNull()
    expect(plan.state.order).toEqual([])
  })

  it('fires the next item once its share of the waking window has elapsed, and rotates the pointer', () => {
    const seedNow = at(6) // stays within the same calendar day after +720min (18:00)
    const seeded = philosophyPlan(['a', 'b'], {}, OFF, seedNow) // OFF quiet -> 1440min waking / 2 items = 720min interval
    const dueAt = seedNow + 720 * MIN
    const plan = philosophyPlan(['a', 'b'], seeded.state, OFF, dueAt)
    expect(plan.fire).toBe(seeded.state.order[0])
    expect(plan.state.index).toBe(1)
    expect(plan.state.anchor).toBe(dueAt)
  })

  it('does not fire before its share of the window has elapsed', () => {
    const seedNow = at(6)
    const seeded = philosophyPlan(['a', 'b'], {}, OFF, seedNow)
    const plan = philosophyPlan(['a', 'b'], seeded.state, OFF, seedNow + 719 * MIN)
    expect(plan.fire).toBeNull()
  })

  it('suppresses the fire during quiet hours but still advances the pointer', () => {
    // DEFAULT_QUIET -> 960min waking / 2 items = 480min interval. Seeding at
    // 07:00 (waking start) keeps both steps on the same calendar day: 15:00
    // (still waking) then 23:00 (exactly the quiet-hours start).
    const seedNow = at(7)
    const seeded = philosophyPlan(['a', 'b'], {}, DEFAULT_QUIET, seedNow)
    const dueAt = seedNow + 480 * MIN // 15:00, still outside quiet
    const inWindow = philosophyPlan(['a', 'b'], seeded.state, DEFAULT_QUIET, dueAt)
    expect(inWindow.fire).not.toBeNull()
    const nextDueAt = dueAt + 480 * MIN // 23:00, inside the default quiet window
    const suppressed = philosophyPlan(['a', 'b'], inWindow.state, DEFAULT_QUIET, nextDueAt)
    expect(suppressed.fire).toBeNull()
    expect(suppressed.state.anchor).toBe(nextDueAt)
    expect(suppressed.state.index).toBe((inWindow.state.index + 1) % 2)
  })

  it('reshuffles and resets when the enabled id set changes', () => {
    const seedNow = at(12)
    const seeded = philosophyPlan(['a', 'b'], {}, OFF, seedNow)
    const changed = philosophyPlan(['a', 'b', 'c'], seeded.state, OFF, seedNow + 10 * MIN)
    expect(changed.fire).toBeNull()
    expect(changed.state.order.sort()).toEqual(['a', 'b', 'c'])
    expect(changed.state.index).toBe(0)
    expect(changed.state.anchor).toBe(seedNow + 10 * MIN)
  })

  it('reshuffles at the next local day', () => {
    const day1 = at(12)
    const seeded = philosophyPlan(['a', 'b'], {}, OFF, day1)
    const day2 = new Date(2026, 7, 5, 12, 0, 0, 0).getTime()
    const rolled = philosophyPlan(['a', 'b'], seeded.state, OFF, day2)
    expect(rolled.fire).toBeNull()
    expect(rolled.state.anchor).toBe(day2)
  })
})

describe('nextPhilosophyFireAt', () => {
  it('is the anchor plus the per-item share of the waking window', () => {
    const state = { day: 'x', order: ['a', 'b'], index: 0, anchor: at(12) }
    expect(nextPhilosophyFireAt(state, OFF)).toBe(at(12) + 720 * MIN)
  })

  it('is null with no order or an empty one', () => {
    expect(nextPhilosophyFireAt(undefined, OFF)).toBeNull()
    expect(nextPhilosophyFireAt({ order: [] }, OFF)).toBeNull()
  })
})
