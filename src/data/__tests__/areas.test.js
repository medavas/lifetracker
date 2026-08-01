import { describe, it, expect } from 'vitest'
import * as lucide from 'lucide-react'
import { AREAS } from '../areas'

const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  fitness: { trim: 'r', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  habits: { trim: 'y', icon: 'KeyRound' },
  journal: { trim: 'v', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  learnings: { trim: 'b', icon: 'Brain' },
}

describe('area registry', () => {
  it('has exactly the 9 known areas', () => {
    expect(AREAS.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it('maps each area to the spec trim and lucide icon name', () => {
    for (const a of AREAS) {
      expect({ id: a.id, trim: a.trim, icon: a.icon }).toEqual({ id: a.id, ...EXPECTED[a.id] })
    }
  })

  it('uses each trim color at most twice', () => {
    const counts = {}
    for (const a of AREAS) counts[a.trim] = (counts[a.trim] || 0) + 1
    for (const count of Object.values(counts)) expect(count).toBeLessThanOrEqual(2)
  })

  it('every icon name resolves to a lucide component', () => {
    for (const a of AREAS) expect(typeof lucide[a.icon]).not.toBe('undefined')
  })

  it('gradients are gone from the registry', () => {
    for (const a of AREAS) expect(a.grad).toBeUndefined()
  })

  it('finance absorbed budget\'s buckets and keywords', () => {
    const finance = AREAS.find((a) => a.id === 'finance')
    expect(finance.buckets).toEqual(['Bills', 'Insurance', 'Investments', 'Savings', 'Fixed', 'Variable', 'Goals'])
    expect(finance.keywords).toEqual(
      expect.arrayContaining(['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay', 'budget', 'spend', 'expense', 'cost'])
    )
  })
})
