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

describe('money fields on items', () => {
  beforeEach(reset)

  it('persists amount, cadence, and nextDue when supplied', () => {
    const b = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-09-01',
    })
    const stored = useStore.getState().items.find((i) => i.id === b.id)
    expect(stored.amount).toBe(120000)
    expect(stored.cadence).toBe('monthly')
    expect(stored.nextDue).toBe('2026-09-01')
  })

  it('leaves ordinary items free of money fields', () => {
    const it_ = useStore.getState().addItem('projects', 'ship it')
    const stored = useStore.getState().items.find((i) => i.id === it_.id)
    expect('amount' in stored).toBe(false)
    expect('cadence' in stored).toBe(false)
    expect('nextDue' in stored).toBe(false)
  })
})

describe('money logs', () => {
  beforeEach(reset)

  it('logSpend writes a spend log and awards no points', () => {
    const cat = useStore.getState().addItem('finance', 'Groceries', { bucket: 'Spending', amount: 40000 })
    useStore.getState().logSpend(cat.id, 1450, 'coffee')
    const log = useStore.getState().logs.find((l) => l.kind === 'spend')
    expect(log.itemId).toBe(cat.id)
    expect(log.amount).toBe(1450)
    expect(log.note).toBe('coffee')
    expect(log.areaId).toBe('finance')
    expect(useStore.getState().points).toBe(0)
  })

  it('logSpend without a category or note stays uncategorized and note-free', () => {
    useStore.getState().logSpend(null, 300)
    const log = useStore.getState().logs.find((l) => l.kind === 'spend')
    expect(log.itemId).toBeNull()
    expect('note' in log).toBe(false)
  })

  it('payBill logs the bill amount, stamps prevDue, and advances nextDue', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-01-31',
    })
    useStore.getState().payBill(bill.id)
    const log = useStore.getState().logs.find((l) => l.kind === 'bill-pay')
    expect(log.amount).toBe(120000)
    expect(log.prevDue).toBe('2026-01-31')
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-02-28')
    expect(useStore.getState().points).toBe(0)
  })

  it('payBill without any amount is a no-op', () => {
    const bill = useStore.getState().addItem('finance', 'Mystery', {
      bucket: 'Bills', cadence: 'monthly', nextDue: '2026-09-01',
    })
    useStore.getState().payBill(bill.id)
    expect(useStore.getState().logs).toHaveLength(0)
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-09-01')
  })

  it('deleteMoneyLog on a payment restores the exact prior due date', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-01-31',
    })
    useStore.getState().payBill(bill.id)
    const log = useStore.getState().logs.find((l) => l.kind === 'bill-pay')
    useStore.getState().deleteMoneyLog(log.id)
    expect(useStore.getState().logs.find((l) => l.id === log.id).deletedAt).toBeTruthy()
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-01-31')
  })

  it('contribute writes a contribute log toward the goal', () => {
    const goal = useStore.getState().addItem('finance', 'Emergency fund', { bucket: 'Goals', amount: 500000 })
    useStore.getState().contribute(goal.id, 25000)
    const log = useStore.getState().logs.find((l) => l.kind === 'contribute')
    expect(log.itemId).toBe(goal.id)
    expect(log.amount).toBe(25000)
    expect(useStore.getState().points).toBe(0)
  })

  it('money fields round-trip through a sync merge', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-09-01',
    })
    const remote = [{
      kind: 'item', id: bill.id, updatedAt: bill.updatedAt + 1000, deletedAt: null,
      data: { ...bill, amount: 125000, nextDue: '2026-10-01', updatedAt: bill.updatedAt + 1000 },
    }]
    useStore.getState().mergeRemote(remote)
    const merged = useStore.getState().items.find((i) => i.id === bill.id)
    expect(merged.amount).toBe(125000)
    expect(merged.nextDue).toBe('2026-10-01')
  })
})
