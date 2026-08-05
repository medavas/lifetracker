import { describe, it, expect, vi } from 'vitest'
import { createRunner, TICK_MS } from '../nudgeRunner.js'
import { DEFAULT_QUIET } from '../timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

/** Wires createRunner to plain objects instead of localStorage and the DOM. */
const harness = ({ nudges, lastFired = {}, quiet = OFF, now }) => {
  let anchors = { ...lastFired }
  const fired = []
  const runner = createRunner({
    getNudges: () => nudges,
    getLastFired: () => anchors,
    setLastFired: (next) => { anchors = next },
    getQuiet: () => quiet,
    fire: (body, tag) => { fired.push({ body, tag }); return Promise.resolve(true) },
    now: () => now,
  })
  return { runner, fired, anchors: () => anchors }
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })

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
})
