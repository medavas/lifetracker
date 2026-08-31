import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createRunner,
  TICK_MS,
  PHILOSOPHY_TAG,
  readLastFired,
  writeLastFired,
  seedAnchor,
  clearAnchor,
  readQuiet,
  writeQuiet,
  readPhilosophyOn,
  writePhilosophyOn,
  readPhilosophyRotation,
  writePhilosophyRotation,
} from '../nudgeRunner.js'
import { DEFAULT_QUIET } from '../timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

/** Wires createRunner to plain objects instead of localStorage and the DOM. */
const harness = ({ nudges, lastFired = {}, quiet = OFF, now, philosophy }) => {
  let anchors = { ...lastFired }
  let philRotation = philosophy?.rotation ?? {}
  const fired = []
  const runner = createRunner({
    getNudges: () => nudges,
    getLastFired: () => anchors,
    setLastFired: (next) => { anchors = next },
    getQuiet: () => quiet,
    fire: (body, tag) => { fired.push({ body, tag }); return Promise.resolve(true) },
    now: () => now,
    ...(philosophy && {
      getPhilosophyOn: () => philosophy.on,
      getPhilosophyEnabled: () => philosophy.items,
      getPhilosophyRotation: () => philRotation,
      setPhilosophyRotation: (next) => { philRotation = next },
    }),
  })
  return { runner, fired, anchors: () => anchors, philRotation: () => philRotation }
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })
const daily = (id, timeMin, enabled = true) => ({ id, title: `${id} message`, timeMin, enabled })

describe('createRunner', () => {
  it('ticks every 15 seconds', () => {
    expect(TICK_MS).toBe(15_000)
  })

  it('fires the due nudge with its title as the body and its id as the tag', () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 45 * MIN }, now })
    h.runner.tick()
    expect(h.fired).toEqual([{ body: 'a message', tag: 'a' }])
  })

  it('persists the new anchor so the next tick does not re-fire', () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 45 * MIN }, now })
    h.runner.tick()
    expect(h.anchors()).toEqual({ a: now })
    h.runner.tick()
    expect(h.fired).toHaveLength(1)
  })

  it('writes nothing and fires nothing when no nudge is due', () => {
    const now = at(12)
    const setLastFired = vi.fn()
    const runner = createRunner({
      getNudges: () => [nudge('a', 45)],
      getLastFired: () => ({ a: now - 10 * MIN }),
      setLastFired,
      getQuiet: () => OFF,
      fire: () => Promise.resolve(true),
      now: () => now,
    })
    expect(runner.tick().fire).toEqual([])
    expect(setLastFired).not.toHaveBeenCalled()
  })

  it('advances the anchor without firing during quiet hours', () => {
    const now = at(3)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 90 * MIN }, quiet: DEFAULT_QUIET, now })
    h.runner.tick()
    expect(h.fired).toEqual([])
    expect(h.anchors()).toEqual({ a: now })
  })

  it('preserves anchors of nudges that did not fire', () => {
    const now = at(12)
    const h = harness({
      nudges: [nudge('a', 45), nudge('b', 120)],
      lastFired: { a: now - 46 * MIN, b: now - 10 * MIN },
      now,
    })
    h.runner.tick()
    expect(h.anchors()).toEqual({ a: now, b: now - 10 * MIN })
  })

  it('does not re-fire when the notification itself rejects', async () => {
    const now = at(12)
    let anchors = { a: now - 45 * MIN }
    const runner = createRunner({
      getNudges: () => [nudge('a', 45)],
      getLastFired: () => anchors,
      setLastFired: (next) => { anchors = next },
      getQuiet: () => OFF,
      fire: () => Promise.reject(new Error('blocked')),
      now: () => now,
    })
    expect(() => runner.tick()).not.toThrow()
    await Promise.resolve()
    expect(anchors).toEqual({ a: now })
  })

  it('fires a due daily nudge alongside interval nudges in the same tick', () => {
    const now = at(6, 30)
    const h = harness({
      nudges: [nudge('a', 45), daily('b', 6 * 60 + 30)],
      lastFired: { a: now - 45 * MIN },
      now,
    })
    h.runner.tick()
    expect(h.fired.sort((x, y) => x.tag.localeCompare(y.tag))).toEqual([
      { body: 'a message', tag: 'a' },
      { body: 'b message', tag: 'b' },
    ])
    expect(h.anchors()).toEqual({ a: now, b: now })
  })

  it('fires a daily nudge during quiet hours, unlike an interval nudge', () => {
    const now = at(23, 30)
    const h = harness({
      nudges: [nudge('a', 45), daily('b', 23 * 60 + 30)],
      lastFired: { a: now - 90 * MIN },
      quiet: DEFAULT_QUIET,
      now,
    })
    h.runner.tick()
    expect(h.fired).toEqual([{ body: 'b message', tag: 'b' }])
  })

  it('does nothing philosophy-related when the feature is off', () => {
    const now = at(12)
    const h = harness({ nudges: [], now })
    const plan = h.runner.tick()
    expect(plan.fire).toEqual([])
  })

  it('fires the philosophy rotation using the quote title and details as the body', () => {
    const now = at(6)
    const items = [{ id: 'q1', title: 'Amor fati', details: 'Marcus Aurelius' }]
    const h = harness({
      nudges: [],
      now,
      philosophy: { on: true, items, rotation: { day: '', order: [], index: 0, anchor: 0 } },
    })
    // First tick just seeds the day's order (1 item -> 1440min interval), no fire yet.
    h.runner.tick()
    expect(h.fired).toEqual([])
    expect(h.philRotation().order).toEqual(['q1'])
  })

  it('fires the philosophy rotation once its interval elapses, with title + details as the body', () => {
    // DEFAULT_QUIET -> 960min waking; a single item's whole share is 960min.
    // Seeding at 06:00 (waking start) keeps the due moment (22:00) on the
    // same calendar day, so it fires instead of rolling over to a new day.
    const seedNow = at(6)
    const items = [{ id: 'q1', title: 'Amor fati', details: 'Marcus Aurelius' }]
    const h = harness({ nudges: [], quiet: DEFAULT_QUIET, now: seedNow, philosophy: { on: true, items } })
    h.runner.tick() // seeds
    const dueAt = seedNow + 960 * MIN
    const h2 = harness({
      nudges: [],
      quiet: DEFAULT_QUIET,
      now: dueAt,
      philosophy: { on: true, items, rotation: h.philRotation() },
    })
    h2.runner.tick()
    expect(h2.fired).toEqual([{ body: 'Amor fati — Marcus Aurelius', tag: PHILOSOPHY_TAG }])
  })
})

// ── Device-local storage ────────────────────────────────────────
// The localStorage-backed half of nudgeRunner.js (readJson/writeJson and the
// six functions built on them) was previously untested -- see nudge-timers
// final review finding #6. A Map-backed stub makes it testable under the
// node vitest environment, the same `vi.stubGlobal` pattern notify.test.js
// already uses for browser globals.
const LAST_KEY = 'stoa.nudge.lastFired'
const QUIET_KEY = 'stoa.nudge.quiet'

const stubLocalStorage = () => {
  const map = new Map()
  const storage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('device-local storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('seedAnchor sets the anchor to now', () => {
    stubLocalStorage()
    vi.spyOn(Date, 'now').mockReturnValue(12345)
    seedAnchor('a')
    expect(readLastFired()).toEqual({ a: 12345 })
    vi.spyOn(Date, 'now').mockRestore()
  })

  it('clearAnchor deletes only its own id', () => {
    stubLocalStorage()
    writeLastFired({ a: 1, b: 2 })
    clearAnchor('a')
    expect(readLastFired()).toEqual({ b: 2 })
  })

  it('readQuiet merges a partial stored config over DEFAULT_QUIET', () => {
    const storage = stubLocalStorage()
    storage.setItem(QUIET_KEY, JSON.stringify({ on: false }))
    expect(readQuiet()).toEqual({ ...DEFAULT_QUIET, on: false })
  })

  it('readQuiet repairs a non-finite startMin/endMin back to the default', () => {
    const storage = stubLocalStorage()
    // The exact corruption from finding #3: clearing a quiet-hours input
    // persists `null` (JSON.stringify(NaN) -> null), which a plain spread
    // over DEFAULT_QUIET does not repair -- spread skips absent keys, not
    // null-valued ones.
    storage.setItem(QUIET_KEY, JSON.stringify({ on: true, startMin: null, endMin: 420 }))
    expect(readQuiet()).toEqual({ on: true, startMin: DEFAULT_QUIET.startMin, endMin: 420 })
  })

  it('readLastFired returns the fallback on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(LAST_KEY, '{not json')
    expect(readLastFired()).toEqual({})
  })

  it('writeLastFired swallows a throwing setItem (quota) without propagating', () => {
    stubLocalStorage()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => {},
    })
    expect(() => writeLastFired({ a: 1 })).not.toThrow()
  })

  it('writeQuiet round-trips through readQuiet', () => {
    stubLocalStorage()
    writeQuiet({ on: false, startMin: 60, endMin: 120 })
    expect(readQuiet()).toEqual({ on: false, startMin: 60, endMin: 120 })
  })

  it('readPhilosophyOn defaults to false, and round-trips through writePhilosophyOn', () => {
    stubLocalStorage()
    expect(readPhilosophyOn()).toBe(false)
    writePhilosophyOn(true)
    expect(readPhilosophyOn()).toBe(true)
  })

  it('readPhilosophyRotation defaults to an empty object, and round-trips through writePhilosophyRotation', () => {
    stubLocalStorage()
    expect(readPhilosophyRotation()).toEqual({})
    const state = { day: '2026-7-4', order: ['a', 'b'], index: 1, anchor: 12345 }
    writePhilosophyRotation(state)
    expect(readPhilosophyRotation()).toEqual(state)
  })
})
