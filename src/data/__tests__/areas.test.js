import { describe, it, expect } from 'vitest'
import * as lucide from 'lucide-react'
import { AREAS } from '../areas'

const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  budget: { trim: 'g', icon: 'ChartColumn' },
  work: { trim: 'o', icon: 'Briefcase' },
  fitness: { trim: 'r', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  schedule: { trim: 'o', icon: 'CalendarDays' },
  habits: { trim: 'y', icon: 'KeyRound' },
  journal: { trim: 'v', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  learnings: { trim: 'b', icon: 'Brain' },
}

describe('area registry', () => {
  it('has exactly the 12 known areas', () => {
    expect(AREAS.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it('maps each area to the spec trim and lucide icon name', () => {
    for (const a of AREAS) {
      expect({ id: a.id, trim: a.trim, icon: a.icon }).toEqual({ id: a.id, ...EXPECTED[a.id] })
    }
  })

  it('uses each trim color exactly twice', () => {
    const counts = {}
    for (const a of AREAS) counts[a.trim] = (counts[a.trim] || 0) + 1
    expect(counts).toEqual({ r: 2, o: 2, y: 2, g: 2, b: 2, v: 2 })
  })

  it('every icon name resolves to a lucide component', () => {
    for (const a of AREAS) expect(typeof lucide[a.icon]).not.toBe('undefined')
  })

  it('gradients are gone from the registry', () => {
    for (const a of AREAS) expect(a.grad).toBeUndefined()
  })
})
