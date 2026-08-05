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

describe('nudge fields on items', () => {
  beforeEach(reset)

  it('persists intervalMin and enabled when an interval is supplied', () => {
    const n = useStore.getState().addItem('nudges', 'drink water', {
      type: 'timer', intervalMin: 120, enabled: true,
    })
    const stored = useStore.getState().items.find((i) => i.id === n.id)
    expect(stored.intervalMin).toBe(120)
    expect(stored.enabled).toBe(true)
    expect(stored.type).toBe('timer')
  })

  it('defaults a new nudge to switched off', () => {
    const n = useStore.getState().addItem('nudges', 'stand up', { type: 'timer', intervalMin: 45 })
    expect(useStore.getState().items.find((i) => i.id === n.id).enabled).toBe(false)
  })

  it('leaves ordinary items free of nudge fields', () => {
    const it = useStore.getState().addItem('projects', 'ship it')
    const stored = useStore.getState().items.find((i) => i.id === it.id)
    expect('intervalMin' in stored).toBe(false)
    expect('enabled' in stored).toBe(false)
  })

  it('round-trips both fields through a sync merge', () => {
    const n = useStore.getState().addItem('nudges', 'stretch', { type: 'timer', intervalMin: 30 })
    const remote = [{
      kind: 'item', id: n.id, updatedAt: n.updatedAt + 1000, deletedAt: null,
      data: { ...n, enabled: true, intervalMin: 90, updatedAt: n.updatedAt + 1000 },
    }]
    useStore.getState().mergeRemote(remote)
    const merged = useStore.getState().items.find((i) => i.id === n.id)
    expect(merged.enabled).toBe(true)
    expect(merged.intervalMin).toBe(90)
  })
})

describe('habit check-ins outside the Habits area', () => {
  beforeEach(reset)

  it('a habit-check on a fitness priority item lands in the fitness band, not habits', () => {
    const item = useStore.getState().addItem('fitness', 'squats', { bucket: 'Top Priorities' })
    useStore.getState().toggleHabitToday(item.id)
    const log = useStore.getState().logs.find((l) => l.kind === 'habit-check')
    expect(log.areaId).toBe('fitness')
    expect(useStore.getState().points).toBe(5)
  })
})
