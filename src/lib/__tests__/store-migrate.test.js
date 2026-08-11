import { describe, it, expect, afterEach } from 'vitest'
import { useStore } from '../store.js'
import { idbStorage } from '../storage.js'

// Regression for: bumping persist `version` (1 -> 2) with no `migrate` option
// makes zustand silently reset the store to its fresh initial state on the
// first load of old data (logs a console.error, merges `undefined`). See the
// comment above `migrate` in store.js.
describe('persist migration does not lose pre-existing data', () => {
  afterEach(async () => {
    await idbStorage.removeItem('stoa')
    useStore.setState({ items: [], notes: [], logs: [], points: 0 })
  })

  it('migrate is a passthrough — returns persisted state unchanged', () => {
    const { migrate } = useStore.persist.getOptions()
    expect(typeof migrate).toBe('function')

    const v1State = {
      items: [
        {
          id: 'a1',
          areaId: 'work',
          title: 'old task',
          status: 'open',
          order: 0,
          createdAt: 1,
          updatedAt: 1,
          completedAt: null,
          // no `deletedAt` — pre-tombstone (v1) shape
        },
      ],
      logs: [],
      notes: [],
      points: 0,
    }

    expect(migrate(v1State, 1)).toEqual(v1State)
    expect(migrate(v1State, 1)).toBe(v1State)
  })

  it('rehydrating from a version-1 snapshot preserves existing items instead of wiping them', async () => {
    const legacyItem = {
      id: 'legacy-1',
      areaId: 'work',
      title: 'legacy task',
      status: 'open',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
      completedAt: null,
      // deliberately no `deletedAt` field, matching real pre-migration records
    }

    await idbStorage.setItem(
      'stoa',
      JSON.stringify({
        state: { items: [legacyItem], logs: [], notes: [], points: 0 },
        version: 1,
      }),
    )

    await useStore.persist.rehydrate()

    const items = useStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('legacy-1')
    // missing deletedAt must still read as "not deleted" everywhere downstream
    expect(items[0].deletedAt).toBeFalsy()
  })
})

describe('v3 migration remaps old finance buckets', () => {
  it('moves each old bucket to its dashboard home and stamps updatedAt', () => {
    const { migrate } = useStore.persist.getOptions()
    const mk = (id, bucket) => ({
      id, areaId: 'finance', bucket, title: id, status: 'open',
      order: 0, createdAt: 1, updatedAt: 1, completedAt: null, deletedAt: null,
    })
    const v2 = {
      items: [
        mk('a', 'Bills'), mk('b', 'Fixed'), mk('c', 'Variable'),
        mk('d', 'Savings'), mk('e', 'Goals'), mk('f', 'Insurance'), mk('g', 'Investments'),
        { ...mk('h', 'Active'), areaId: 'projects' },
      ],
      logs: [], notes: [], points: 0,
    }
    const out = migrate(v2, 2)
    const bucketOf = (id) => out.items.find((i) => i.id === id).bucket
    expect(bucketOf('a')).toBe('Bills')
    expect(bucketOf('b')).toBe('Bills')
    expect(bucketOf('c')).toBe('Spending')
    expect(bucketOf('d')).toBe('Goals')
    expect(bucketOf('e')).toBe('Goals')
    expect(bucketOf('f')).toBe('Other')
    expect(bucketOf('g')).toBe('Other')
    expect(out.items.find((i) => i.id === 'h').bucket).toBe('Active')
    expect(out.items.find((i) => i.id === 'b').updatedAt).toBeGreaterThan(1)
    expect(out.items.find((i) => i.id === 'a').updatedAt).toBe(1) // already home — untouched
  })

  it('returns the same object when nothing needs remapping', () => {
    const { migrate } = useStore.persist.getOptions()
    const clean = { items: [{ id: 'x', areaId: 'projects', bucket: 'Active', updatedAt: 1 }], logs: [], notes: [], points: 0 }
    expect(migrate(clean, 2)).toBe(clean)
  })
})

describe('v4 migration stamps spending-category colors', () => {
  const { migrate } = useStore.persist.getOptions()
  const mk = (id, bucket, extra = {}) => ({
    id, areaId: 'finance', bucket, title: id, status: 'open',
    order: 0, createdAt: 1, updatedAt: 1, completedAt: null, deletedAt: null, ...extra,
  })

  it('gives every uncolored category a distinct in-range slot and leaves others alone', () => {
    const v3 = {
      items: [mk('a', 'Spending'), mk('b', 'Spending'), mk('c', 'Bills'), mk('d', 'Spending', { color: 7 })],
      logs: [], notes: [], points: 0,
    }
    const byId = (out, id) => out.items.find((i) => i.id === id)
    const out = migrate(v3, 3)
    expect(byId(out, 'a').color).toBe(1)
    expect(byId(out, 'b').color).toBe(2)
    expect(byId(out, 'c').color).toBeUndefined()
    expect(byId(out, 'd').color).toBe(7)
    expect(byId(out, 'd').updatedAt).toBe(1) // already colored — untouched
    expect(byId(out, 'a').updatedAt).toBeGreaterThan(1)
  })

  it('runs after the v3 bucket remap, so a remapped category is colored too', () => {
    const v2 = { items: [mk('c', 'Variable')], logs: [], notes: [], points: 0 }
    const out = migrate(v2, 2)
    expect(out.items[0]).toMatchObject({ bucket: 'Spending', color: 1 })
  })

  it('is a passthrough for a store already on v4', () => {
    const current = { items: [mk('a', 'Spending')], logs: [], notes: [], points: 0 }
    expect(migrate(current, 4)).toBe(current)
  })
})

describe('v5 migration renames Learnings to Academia', () => {
  const { migrate } = useStore.persist.getOptions()

  it('remaps areaId on both items and notes and stamps updatedAt', () => {
    const v4 = {
      items: [
        { id: 'a', areaId: 'learnings', bucket: 'Read', title: 'a', status: 'open', order: 0, createdAt: 1, updatedAt: 1, completedAt: null, deletedAt: null },
        { id: 'b', areaId: 'projects', bucket: 'Active', title: 'b', status: 'open', order: 0, createdAt: 1, updatedAt: 1, completedAt: null, deletedAt: null },
      ],
      notes: [
        { id: 'n1', areaId: 'learnings', itemId: 'a', text: 'note', createdAt: 1, updatedAt: 1 },
      ],
      logs: [], points: 0,
    }
    const out = migrate(v4, 4)
    expect(out.items.find((i) => i.id === 'a')).toMatchObject({ areaId: 'academia' })
    expect(out.items.find((i) => i.id === 'a').updatedAt).toBeGreaterThan(1)
    expect(out.items.find((i) => i.id === 'b').areaId).toBe('projects')
    expect(out.notes.find((n) => n.id === 'n1')).toMatchObject({ areaId: 'academia' })
  })

  it('returns the same object when nothing is on the old areaId', () => {
    const clean = { items: [{ id: 'x', areaId: 'academia', updatedAt: 1 }], logs: [], notes: [], points: 0 }
    expect(migrate(clean, 4)).toBe(clean)
  })

  it('is a passthrough for a store already on v5', () => {
    const current = { items: [{ id: 'x', areaId: 'academia', updatedAt: 1 }], logs: [], notes: [], points: 0 }
    expect(migrate(current, 5)).toBe(current)
  })
})
