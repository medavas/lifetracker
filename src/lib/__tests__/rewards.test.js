import { describe, it, expect } from 'vitest'
import { computePoints } from '../rewards.js'

const log = (over) => ({ id: Math.random().toString(), itemId: 'i', areaId: 'a', date: '2026-07-26', createdAt: 1, updatedAt: 1, deletedAt: null, ...over })

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
