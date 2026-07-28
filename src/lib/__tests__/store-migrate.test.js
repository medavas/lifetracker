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
