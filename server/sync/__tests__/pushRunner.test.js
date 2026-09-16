import { describe, it, expect } from 'vitest'
import { createPushRunner } from '../pushRunner.js'
import { DEFAULT_QUIET } from '../../../src/lib/timers.js'

const MIN = 60_000
const OFF = { on: false, startMin: 0, endMin: 0 }
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

const harness = ({ nudges, lastFired = {}, quiet = OFF, now }) => {
  let anchors = { ...lastFired }
  const sent = []
  const runner = createPushRunner({
    getNudges: () => nudges,
    getLastFired: () => anchors,
    setLastFired: (next) => { anchors = next },
    getQuiet: () => quiet,
    sendPush: (body) => { sent.push(body); return Promise.resolve() },
    now: () => now,
  })
  return { runner, sent, anchors: () => anchors }
}

const nudge = (id, intervalMin, enabled = true) => ({ id, title: `${id} message`, intervalMin, enabled })
const daily = (id, timeMin, enabled = true) => ({ id, title: `${id} message`, timeMin, enabled })

describe('createPushRunner', () => {
  it('sends a push for a due interval nudge, using its title as the body', async () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 45 * MIN }, now })
    await h.runner.tick()
    expect(h.sent).toEqual(['a message'])
  })

  it('does not fire early', async () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 10 * MIN }, now })
    await h.runner.tick()
    expect(h.sent).toEqual([])
  })

  it('seeds an anchor instead of firing the first time it sees an enabled nudge', async () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: {}, now })
    await h.runner.tick()
    expect(h.sent).toEqual([])
    expect(h.anchors()).toEqual({ a: now })
  })

  it('suppresses catch-up: one overdue nudge fires once, anchor resets to now', async () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45)], lastFired: { a: now - 400 * MIN }, now })
    await h.runner.tick()
    expect(h.sent).toEqual(['a message'])
    expect(h.anchors()).toEqual({ a: now })
  })

  it('quiet hours suppress the push but still advance the anchor', async () => {
    const now = at(23, 30)
    const h = harness({
      nudges: [nudge('a', 45)],
      lastFired: { a: now - 45 * MIN },
      quiet: DEFAULT_QUIET,
      now,
    })
    await h.runner.tick()
    expect(h.sent).toEqual([])
    expect(h.anchors()).toEqual({ a: now })
  })

  it('fires a due daily reminder once and not again later the same day', async () => {
    const now = at(7, 5)
    const h = harness({ nudges: [daily('a', 7 * 60)], lastFired: {}, now })
    await h.runner.tick()
    expect(h.sent).toEqual(['a message'])

    const later = at(9)
    const h2 = harness({ nudges: [daily('a', 7 * 60)], lastFired: h.anchors(), now: later })
    await h2.runner.tick()
    expect(h2.sent).toEqual([])
  })

  it('ignores disabled nudges', async () => {
    const now = at(12)
    const h = harness({ nudges: [nudge('a', 45, false)], lastFired: { a: now - 400 * MIN }, now })
    await h.runner.tick()
    expect(h.sent).toEqual([])
  })

  it('a failed send does not stop other due nudges or throw', async () => {
    const now = at(12)
    let anchors = { a: now - 45 * MIN, b: now - 45 * MIN }
    const sent = []
    const runner = createPushRunner({
      getNudges: () => [nudge('a', 45), nudge('b', 45)],
      getLastFired: () => anchors,
      setLastFired: (next) => { anchors = next },
      getQuiet: () => OFF,
      sendPush: (body) => (body.startsWith('a') ? Promise.reject(new Error('offline')) : (sent.push(body), Promise.resolve())),
      now: () => now,
    })
    await expect(runner.tick()).resolves.toBeTruthy()
    expect(sent).toEqual(['b message'])
  })
})
