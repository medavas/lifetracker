import { describe, it, expect } from 'vitest'
import * as lucide from 'lucide-react'
import { AREAS, DAILY_BANDS, routeFor } from '../areas'

const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  fitness: { trim: 'y', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  habits: { trim: 'r', icon: 'KeyRound' },
  journal: { trim: 'b', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  academia: { trim: 'o', icon: 'Brain' },
  nudges: { trim: 'o', icon: 'BellRing' },
  focus: { trim: 'v', icon: 'Timer' },
}

describe('area registry', () => {
  it('has exactly the 11 known areas', () => {
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

  it('finance is the money kind with the dashboard buckets', () => {
    const finance = AREAS.find((a) => a.id === 'finance')
    expect(finance.kind).toBe('money')
    expect(finance.route).toBe('/finance')
    expect(finance.buckets).toEqual(['Plan', 'Bills', 'Subscriptions', 'Spending', 'Goals', 'Other'])
    expect(finance.keywords).toEqual(expect.arrayContaining(['money', 'bill', 'subscription', 'budget', 'spend']))
  })
})

describe('daily bands', () => {
  it('marks exactly the five daily-practice areas', () => {
    expect(AREAS.filter((a) => a.daily).map((a) => a.id).sort()).toEqual(
      ['diet', 'fitness', 'habits', 'health', 'journal'],
    )
  })

  it('assigns orders 1..5 with no duplicates', () => {
    const orders = AREAS.filter((a) => a.daily).map((a) => a.daily.order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5])
  })

  it('assigns a distinct series slot to each band', () => {
    const series = AREAS.filter((a) => a.daily).map((a) => a.daily.series)
    expect(new Set(series).size).toBe(series.length)
  })

  it('exposes DAILY_BANDS sorted bottom-to-top', () => {
    expect(DAILY_BANDS.map((a) => a.id)).toEqual(['journal', 'diet', 'fitness', 'habits', 'health'])
  })

  it('gives every band a trim matching its own identity color family', () => {
    const trims = Object.fromEntries(DAILY_BANDS.map((a) => [a.id, a.trim]))
    expect(trims).toEqual({ journal: 'b', diet: 'g', fitness: 'y', habits: 'r', health: 'r' })
  })
})

describe('routing', () => {
  it('gives the nudges area the timers kind and no daily band', () => {
    const nudges = AREAS.find((a) => a.id === 'nudges')
    expect(nudges.kind).toBe('timers')
    expect(nudges.daily).toBeUndefined()
    expect(nudges.buckets).toEqual([])
  })

  it('routes the non-generic areas to their own pages', () => {
    const routes = Object.fromEntries(AREAS.map((a) => [a.id, routeFor(a)]))
    expect(routes.journal).toBe('/journal')
    expect(routes.habits).toBe('/habits')
    expect(routes.nudges).toBe('/nudges')
    expect(routes.finance).toBe('/finance')
    expect(routes.projects).toBe('/projects')
    expect(routes.fitness).toBe('/fitness')
    expect(routes.academia).toBe('/academia')
  })

  it('routes every other area through the generic area view', () => {
    for (const a of AREAS) {
      if (['journal', 'habits', 'nudges', 'finance', 'projects', 'fitness', 'focus', 'academia'].includes(a.id)) continue
      expect(routeFor(a)).toBe(`/area/${a.id}`)
    }
  })

  // The workout page owns the route, but fitness is still a plain 'list' area
  // with a habit bucket: its items, its daily band, and its Top Priorities
  // check-off all keep working exactly as before.
  it('keeps fitness a list-kind area with its original buckets', () => {
    const fitness = AREAS.find((a) => a.id === 'fitness')
    expect(fitness.kind).toBe('list')
    expect(fitness.habitBucket).toBe('Top Priorities')
    expect(fitness.buckets).toEqual(['Top Priorities', 'Routine', 'Goals', 'PRs'])
    expect(fitness.daily).toEqual({ order: 3, series: 4 })
  })

  // A Pomodoro round is work, not one of the daily rhythms the practice
  // views track — the fifth band is Health's supplements instead.
  it('routes focus to its own page with no buckets and no daily band', () => {
    const focus = AREAS.find((a) => a.id === 'focus')
    expect(focus.kind).toBe('focus')
    expect(focus.route).toBe('/focus')
    expect(focus.buckets).toEqual([])
    expect(focus.daily).toBeUndefined()
  })
})

describe('habit-bucket areas', () => {
  it('names Top Priorities as the fitness habit bucket, listed first', () => {
    const fitness = AREAS.find((a) => a.id === 'fitness')
    expect(fitness.habitBucket).toBe('Top Priorities')
    expect(fitness.buckets[0]).toBe('Top Priorities')
  })

  it('names Today\'s Meals as the diet habit bucket, listed first', () => {
    const diet = AREAS.find((a) => a.id === 'diet')
    expect(diet.habitBucket).toBe('Today\'s Meals')
    expect(diet.buckets[0]).toBe('Today\'s Meals')
  })

  it('names Supplements as the health habit bucket, listed last', () => {
    const health = AREAS.find((a) => a.id === 'health')
    expect(health.habitBucket).toBe('Supplements')
    expect(health.buckets).toEqual(['Upcoming', 'Tracking', 'Records', 'Supplements'])
  })

  it('leaves every non-habit-bucket area without one', () => {
    for (const a of AREAS) {
      if (['fitness', 'diet', 'health'].includes(a.id)) continue
      expect(a.habitBucket).toBeUndefined()
    }
  })
})
