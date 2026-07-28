import { describe, it, expect } from 'vitest'
import { toEntities, fromEntities, merge } from '../merge.js'

const item = (over) => ({ id: 'i1', areaId: 'a', title: 't', status: 'open', updatedAt: 10, deletedAt: null, ...over })

describe('toEntities/fromEntities', () => {
  it('round-trips items/notes/logs', () => {
    const state = {
      items: [item()],
      notes: [{ id: 'n1', areaId: 'a', text: 'x', updatedAt: 5, deletedAt: null }],
      logs: [{ id: 'l1', itemId: 'i1', kind: 'complete', date: '2026-07-26', updatedAt: 7, deletedAt: null }],
    }
    const ents = toEntities(state)
    expect(ents).toHaveLength(3)
    expect(ents.find((e) => e.kind === 'item').id).toBe('i1')
    const back = fromEntities(ents)
    expect(back.items[0].title).toBe('t')
    expect(back.logs[0].kind).toBe('complete')
  })
})

describe('merge', () => {
  it('keeps the newer updatedAt per kind:id', () => {
    const a = [{ kind: 'item', id: 'i1', updatedAt: 10, deletedAt: null, data: item({ title: 'old' }) }]
    const b = [{ kind: 'item', id: 'i1', updatedAt: 20, deletedAt: null, data: item({ title: 'new', updatedAt: 20 }) }]
    const m = merge(a, b)
    expect(m).toHaveLength(1)
    expect(m[0].data.title).toBe('new')
  })
  it('a newer tombstone beats an older edit', () => {
    const a = [{ kind: 'note', id: 'n1', updatedAt: 30, deletedAt: null, data: { id: 'n1', text: 'edit' } }]
    const b = [{ kind: 'note', id: 'n1', updatedAt: 40, deletedAt: 40, data: { id: 'n1', text: 'edit' } }]
    expect(merge(a, b)[0].deletedAt).toBe(40)
  })
  it('unions disjoint ids', () => {
    const a = [{ kind: 'item', id: 'i1', updatedAt: 1, deletedAt: null, data: {} }]
    const b = [{ kind: 'item', id: 'i2', updatedAt: 1, deletedAt: null, data: {} }]
    expect(merge(a, b)).toHaveLength(2)
  })
})
