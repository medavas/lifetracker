import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, selectAreaItems } from '../store.js'

const reset = () => useStore.setState({ items: [], notes: [], logs: [], points: 0 })

describe('store tombstones + points', () => {
  beforeEach(reset)

  it('deleteItem tombstones instead of dropping, and hides it', () => {
    const s = useStore.getState()
    const it = s.addItem('work', 'ship it')
    useStore.getState().deleteItem(it.id)
    const all = useStore.getState().items
    expect(all).toHaveLength(1)
    expect(all[0].deletedAt).toBeTruthy()
    expect(selectAreaItems('work')(useStore.getState())).toHaveLength(0)
  })

  it('completing then unchecking leaves a tombstoned log and 0 points', () => {
    const it = useStore.getState().addItem('work', 'task')
    useStore.getState().toggleDone(it.id)
    expect(useStore.getState().points).toBe(10)
    useStore.getState().toggleDone(it.id)
    expect(useStore.getState().points).toBe(0)
    expect(useStore.getState().logs.some((l) => l.deletedAt)).toBe(true)
  })

  it('mergeRemote applies a newer remote edit', () => {
    const it = useStore.getState().addItem('work', 'local title')
    const remote = [{ kind: 'item', id: it.id, updatedAt: it.updatedAt + 1000, deletedAt: null,
      data: { ...it, title: 'remote title', updatedAt: it.updatedAt + 1000 } }]
    useStore.getState().mergeRemote(remote)
    expect(useStore.getState().items.find((i) => i.id === it.id).title).toBe('remote title')
  })
})
