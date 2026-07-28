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

  it('reorderItems bumps updatedAt on moved items so the reorder wins sync merges', async () => {
    const a = useStore.getState().addItem('work', 'a')
    const b = useStore.getState().addItem('work', 'b')
    const staleUpdatedAt = useStore.getState().items.find((i) => i.id === a.id).updatedAt
    // Ensure now() advances even under fast/mocked clocks.
    await new Promise((r) => setTimeout(r, 5))
    useStore.getState().reorderItems('work', [b.id, a.id])
    const [movedA, movedB] = [a.id, b.id].map((id) => useStore.getState().items.find((i) => i.id === id))
    expect(movedA.order).toBe(1)
    expect(movedB.order).toBe(0)
    expect(movedA.updatedAt).toBeGreaterThan(staleUpdatedAt)
    expect(movedB.updatedAt).toBeGreaterThan(staleUpdatedAt)
  })

  it('reorderItems does not touch items outside the reordered area/ids', () => {
    const a = useStore.getState().addItem('work', 'a')
    const other = useStore.getState().addItem('home', 'other')
    const untouched = useStore.getState().addItem('work', 'untouched')
    const beforeOther = useStore.getState().items.find((i) => i.id === other.id).updatedAt
    const beforeUntouched = useStore.getState().items.find((i) => i.id === untouched.id).updatedAt
    useStore.getState().reorderItems('work', [a.id])
    expect(useStore.getState().items.find((i) => i.id === other.id).updatedAt).toBe(beforeOther)
    expect(useStore.getState().items.find((i) => i.id === untouched.id).updatedAt).toBe(beforeUntouched)
  })
})
