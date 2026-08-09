import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, selectAreaItems, selectSubItems } from '../store.js'
import { DEFAULT_PROGRAM, SESSION_BUCKET } from '../../data/workoutProgram.js'
import { DEFAULT_STRETCH_CATEGORIES, STRETCH_BUCKET } from '../../data/stretches.js'
import { buildExerciseIndex } from '../workout.js'

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
    expect('color' in stored).toBe(false)
  })

  it('gives each new spending category the next free color, and nothing else one', () => {
    const add = (bucket, title) => useStore.getState().addItem('finance', title, { bucket })
    expect(add('Spending', 'Groceries').color).toBe(1)
    expect(add('Spending', 'Fun').color).toBe(2)
    expect('color' in add('Bills', 'Rent')).toBe(false)
    // a freed slot is reused rather than skipped
    useStore.getState().archiveItem(useStore.getState().items[0].id)
    expect(add('Spending', 'Transit').color).toBe(1)
  })

  it('honors an explicit color over the auto-assigned one', () => {
    const c = useStore.getState().addItem('finance', 'Fun', { bucket: 'Spending', color: 6 })
    expect(c.color).toBe(6)
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

describe('project sub-tasks', () => {
  beforeEach(reset)

  it('a project with no sub-tasks stays independently toggleable', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    useStore.getState().toggleDone(project.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('adding the first sub-task does not retroactively complete or reopen the project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('completing the last open sub-task completes the project and awards its points once', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
    useStore.getState().toggleDone(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('a sub-task toggle never changes points or writes a complete log on its own', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    // A second, still-open sub-task keeps the project's derived completion
    // from cascading here, isolating what this test is actually about: `a`'s
    // own toggle never touches points/logs on its own account.
    useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().points).toBe(0)
    expect(useStore.getState().logs.some((l) => l.kind === 'complete')).toBe(false)
    expect(useStore.getState().items.find((i) => i.id === a.id).status).toBe('done')
  })

  it('unchecking any sub-task on a completed project reopens it and reverts its points', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('does not un-archive a project when its last live sub-task completes', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().archiveItem(project.id)
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('archived')
    expect(useStore.getState().points).toBe(0)
  })

  it('adding a new open sub-task to an already-completed project reopens it', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('archiving the last incomplete sub-task completes the project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    useStore.getState().archiveItem(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('restoring an archived incomplete sub-task reopens a completed project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().archiveItem(b.id)
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    useStore.getState().restoreItem(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
  })

  it('deleting a project tombstones its sub-tasks', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().deleteItem(project.id)
    expect(useStore.getState().items.find((i) => i.id === a.id).deletedAt).toBeTruthy()
  })

  it('leaves ordinary items free of parentId', () => {
    const it = useStore.getState().addItem('projects', 'ship it')
    expect('parentId' in it).toBe(false)
  })

  it('selectSubItems returns only that parent\'s live sub-tasks, sorted by order', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const other = useStore.getState().addItem('projects', 'Other project')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().addItem('projects', 'Unrelated', { parentId: other.id })
    const subs = selectSubItems(project.id)(useStore.getState())
    expect(subs.map((i) => i.id)).toEqual([a.id, b.id])
  })

  it('reorderSubItems only touches its own parent\'s children', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    const unrelated = useStore.getState().addItem('projects', 'Unrelated top-level')
    const unrelatedOrderBefore = unrelated.order
    useStore.getState().reorderSubItems(project.id, [b.id, a.id])
    expect(useStore.getState().items.find((i) => i.id === a.id).order).toBe(1)
    expect(useStore.getState().items.find((i) => i.id === b.id).order).toBe(0)
    expect(useStore.getState().items.find((i) => i.id === unrelated.id).order).toBe(unrelatedOrderBefore)
  })

  it('refuses to attach a sub-task to another sub-task, enforcing one level of nesting', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const grandchild = useStore.getState().addItem('projects', 'Grandchild', { parentId: a.id })
    expect('parentId' in grandchild).toBe(false)
    const stored = useStore.getState().items.find((i) => i.id === grandchild.id)
    expect('parentId' in stored).toBe(false)
    // `a` itself must not have gained a child either, confirming no link was made at all.
    expect(useStore.getState().items.some((i) => i.parentId === a.id)).toBe(false)
    expect(useStore.getState().points).toBe(0)
  })

  it('restoring an archived project whose sub-tasks are all already done re-derives to done', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
    useStore.getState().archiveItem(project.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('archived')
    useStore.getState().restoreItem(project.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('deleting the last live sub-task leaves the project frozen at its last derived status', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
    useStore.getState().deleteItem(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('archiving the last live sub-task leaves the project frozen at its last derived status', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
    useStore.getState().archiveItem(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })
})

describe('workout program + set logs', () => {
  beforeEach(reset)

  const sessions = () =>
    useStore.getState().items.filter((i) => i.bucket === SESSION_BUCKET && !i.deletedAt)

  it('seeds sessions as parent items and exercises as their sub-items', () => {
    useStore.getState().seedWorkoutProgram()
    expect(sessions()).toHaveLength(DEFAULT_PROGRAM.length)
    for (const s of sessions()) {
      expect(s.parentId).toBeUndefined()
      expect(selectSubItems(s.id)(useStore.getState()).length).toBeGreaterThan(0)
    }
  })

  it('carries weekday onto sessions and the full spec onto exercises', () => {
    useStore.getState().seedWorkoutProgram()
    const upper = sessions().find((s) => s.title === 'Upper Body')
    expect(upper.weekday).toBe(6)
    const bench = selectSubItems(upper.id)(useStore.getState())[0]
    expect(bench).toMatchObject({ sets: 3, low: 6, high: 10, step: 5 })
    expect(bench.details.length).toBeGreaterThan(0)
  })

  it('is idempotent — seeding twice cannot duplicate an edited program', () => {
    useStore.getState().seedWorkoutProgram()
    const before = useStore.getState().items.length
    useStore.getState().seedWorkoutProgram()
    expect(useStore.getState().items).toHaveLength(before)
  })

  it('keeps an assistance machine negative so progression runs downward', () => {
    useStore.getState().seedWorkoutProgram()
    const full = sessions().find((s) => s.title === 'Full Body')
    const assisted = selectSubItems(full.id)(useStore.getState()).find((e) => e.step < 0)
    expect(assisted.step).toBe(-5)
  })

  it('logs a set against the exercise item and awards no points', () => {
    const session = useStore.getState().addItem('fitness', 'Upper', { bucket: SESSION_BUCKET, weekday: 6 })
    const bench = useStore.getState().addItem('fitness', 'Bench', { parentId: session.id, sets: 3, low: 6, high: 10 })
    useStore.getState().logSet(bench.id, 135, 8)
    const log = useStore.getState().logs.find((l) => l.kind === 'set')
    expect(log).toMatchObject({ itemId: bench.id, areaId: 'fitness', weight: 135, reps: 8 })
    expect(useStore.getState().points).toBe(0)
  })

  it('deleteSet tombstones rather than dropping, so sync can propagate it', () => {
    const session = useStore.getState().addItem('fitness', 'Upper', { bucket: SESSION_BUCKET })
    const bench = useStore.getState().addItem('fitness', 'Bench', { parentId: session.id })
    useStore.getState().logSet(bench.id, 135, 8)
    const log = useStore.getState().logs[0]
    useStore.getState().deleteSet(log.id)
    expect(useStore.getState().logs).toHaveLength(1)
    expect(useStore.getState().logs[0].deletedAt).toBeTruthy()
  })

  it('retiring an exercise keeps its logged sets; deleting it takes them', () => {
    const session = useStore.getState().addItem('fitness', 'Upper', { bucket: SESSION_BUCKET })
    const bench = useStore.getState().addItem('fitness', 'Bench', { parentId: session.id })
    useStore.getState().logSet(bench.id, 135, 8)
    useStore.getState().archiveItem(bench.id)
    expect(useStore.getState().logs.every((l) => !l.deletedAt)).toBe(true)
    useStore.getState().deleteItem(bench.id)
    expect(useStore.getState().logs.every((l) => l.deletedAt)).toBe(true)
  })

  it('never lets an exercise nest under another exercise', () => {
    const session = useStore.getState().addItem('fitness', 'Upper', { bucket: SESSION_BUCKET })
    const bench = useStore.getState().addItem('fitness', 'Bench', { parentId: session.id })
    const nested = useStore.getState().addItem('fitness', 'Nope', { parentId: bench.id })
    expect(nested.parentId).toBeUndefined()
  })

  it('leaves a session item untouched by its exercises, which are never toggled done', () => {
    useStore.getState().seedWorkoutProgram()
    const upper = sessions().find((s) => s.title === 'Upper Body')
    expect(upper.status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })
})

describe('stretch categories', () => {
  beforeEach(reset)

  const cats = () =>
    useStore.getState().items
      .filter((i) => i.bucket === STRETCH_BUCKET && !i.deletedAt)
      .sort((a, b) => a.order - b.order)

  it('seeds the starter categories empty, so nothing has to be deleted first', () => {
    useStore.getState().seedStretchCategories()
    expect(cats().map((c) => c.title)).toEqual(DEFAULT_STRETCH_CATEGORIES)
    for (const c of cats()) {
      expect(selectSubItems(c.id)(useStore.getState())).toEqual([])
    }
  })

  it('is idempotent — seeding twice cannot duplicate edited categories', () => {
    useStore.getState().seedStretchCategories()
    const before = useStore.getState().items.length
    useStore.getState().seedStretchCategories()
    expect(useStore.getState().items).toHaveLength(before)
  })

  it('moveSubItem re-parents a stretch and orders it in its new home', () => {
    const hips = useStore.getState().addItem('fitness', 'Hips', { bucket: STRETCH_BUCKET })
    const hams = useStore.getState().addItem('fitness', 'Hamstrings', { bucket: STRETCH_BUCKET })
    const pigeon = useStore.getState().addItem('fitness', 'Pigeon', { parentId: hips.id })
    const forwardFold = useStore.getState().addItem('fitness', 'Forward fold', { parentId: hams.id })

    useStore.getState().moveSubItem(pigeon.id, hams.id, [pigeon.id, forwardFold.id])

    expect(selectSubItems(hips.id)(useStore.getState())).toEqual([])
    expect(selectSubItems(hams.id)(useStore.getState()).map((i) => i.title))
      .toEqual(['Pigeon', 'Forward fold'])
  })

  it('moveSubItem bumps updatedAt so the move wins a last-write-wins merge', async () => {
    const a = useStore.getState().addItem('fitness', 'A', { bucket: STRETCH_BUCKET })
    const b = useStore.getState().addItem('fitness', 'B', { bucket: STRETCH_BUCKET })
    const s = useStore.getState().addItem('fitness', 'Pigeon', { parentId: a.id })
    const stale = useStore.getState().items.find((i) => i.id === s.id).updatedAt
    await new Promise((r) => setTimeout(r, 2))
    useStore.getState().moveSubItem(s.id, b.id, [s.id])
    expect(useStore.getState().items.find((i) => i.id === s.id).updatedAt).toBeGreaterThan(stale)
  })

  it('moveSubItem on a missing item is a no-op rather than a throw', () => {
    const a = useStore.getState().addItem('fitness', 'A', { bucket: STRETCH_BUCKET })
    expect(() => useStore.getState().moveSubItem('nope', a.id, ['nope'])).not.toThrow()
    expect(selectSubItems(a.id)(useStore.getState())).toEqual([])
  })

  it('keeps stretches out of the workout exercise index', () => {
    useStore.getState().seedWorkoutProgram()
    const hips = useStore.getState().addItem('fitness', 'Hips', { bucket: STRETCH_BUCKET })
    useStore.getState().addItem('fitness', 'Pigeon', { parentId: hips.id })
    const index = buildExerciseIndex(useStore.getState().items)
    expect([...index.values()].some((e) => e.title === 'Pigeon')).toBe(false)
  })

  it('deleting a category takes its stretches with it', () => {
    const hips = useStore.getState().addItem('fitness', 'Hips', { bucket: STRETCH_BUCKET })
    const pigeon = useStore.getState().addItem('fitness', 'Pigeon', { parentId: hips.id })
    useStore.getState().deleteItem(hips.id)
    expect(useStore.getState().items.find((i) => i.id === pigeon.id).deletedAt).toBeTruthy()
  })
})
