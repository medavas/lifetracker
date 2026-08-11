import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  orderableEntries, HOME_ENTRY, AREAS_GRID_ENTRY, SETTINGS_ENTRY,
  PINNED_IDS, pinnedEntries, mainMenuEntries,
  readSidebarOrder, writeSidebarOrder, orderedEntries,
} from '../sidebarOrder.js'
import { AREAS } from '../../data/areas.js'

const KEY = 'stoa.sidebarOrder'

const stubLocalStorage = () => {
  const map = new Map()
  const storage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('orderableEntries', () => {
  it('leads with Home and the Areas grid, then every area', () => {
    const entries = orderableEntries()
    expect(entries[0]).toEqual(HOME_ENTRY)
    expect(entries[1]).toEqual(AREAS_GRID_ENTRY)
    expect(entries.length).toBe(2 + AREAS.length)
  })

  it('never includes settings', () => {
    expect(orderableEntries().some((e) => e.id === 'settings')).toBe(false)
  })
})

describe('pinnedEntries', () => {
  it('is Home, Nudges, Areas, Settings — the fixed top section', () => {
    expect(pinnedEntries().map((e) => e.id)).toEqual(PINNED_IDS)
    expect(pinnedEntries()[0].route).toBe('/')
    expect(pinnedEntries()).toContainEqual(SETTINGS_ENTRY)
  })
})

describe('mainMenuEntries', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is the saved order with every pinned destination removed', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, JSON.stringify(['home', 'nudges', 'fitness', 'areas', 'diet']))
    // The unlisted areas are appended by readSidebarOrder; only the ranked
    // pair's position is asserted here.
    expect(mainMenuEntries().map((e) => e.id).slice(0, 2)).toEqual(['fitness', 'diet'])
  })

  it('never lists a pinned entry, whatever the saved order', () => {
    stubLocalStorage()
    const ids = mainMenuEntries().map((e) => e.id)
    for (const pinned of PINNED_IDS) expect(ids).not.toContain(pinned)
  })

  it('leaves pinned entries rankable for the bottom bar', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, JSON.stringify(['home', 'fitness']))
    expect(orderedEntries()[0]).toEqual(HOME_ENTRY)
  })
})

describe('readSidebarOrder', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('falls back to the default order with no stored value', () => {
    stubLocalStorage()
    expect(readSidebarOrder()).toEqual(orderableEntries().map((e) => e.id))
  })

  it('falls back to the default order on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, '{not json')
    expect(readSidebarOrder()).toEqual(orderableEntries().map((e) => e.id))
  })

  it('drops a stale id no longer in the entry set', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, JSON.stringify(['home', 'a-removed-area', 'fitness']))
    const order = readSidebarOrder()
    expect(order).not.toContain('a-removed-area')
    expect(order[0]).toBe('home')
    expect(order[1]).toBe('fitness')
  })

  it('appends a missing id (a newly added area) at the end', () => {
    const storage = stubLocalStorage()
    const partial = orderableEntries().map((e) => e.id).filter((id) => id !== 'diet')
    storage.setItem(KEY, JSON.stringify(partial))
    const order = readSidebarOrder()
    expect(order).toHaveLength(orderableEntries().length)
    expect(order[order.length - 1]).toBe('diet')
  })

  it('preserves the stored order for kept ids', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, JSON.stringify(['fitness', 'diet', 'home']))
    const order = readSidebarOrder()
    expect(order.slice(0, 3)).toEqual(['fitness', 'diet', 'home'])
  })
})

describe('orderedEntries', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves saved ids to their full entry objects, in order', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, JSON.stringify(['diet', 'home']))
    const entries = orderedEntries()
    expect(entries[0].id).toBe('diet')
    expect(entries[0].route).toBe('/area/diet')
    expect(entries[1]).toEqual(HOME_ENTRY)
  })
})

describe('writeSidebarOrder', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips through readSidebarOrder', () => {
    stubLocalStorage()
    const custom = ['fitness', 'diet', 'home', 'areas', ...AREAS.map((a) => a.id).filter((id) => id !== 'fitness' && id !== 'diet')]
    writeSidebarOrder(custom)
    expect(readSidebarOrder()).toEqual(custom)
  })

  it('swallows a throwing setItem (quota) without propagating', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => {},
    })
    expect(() => writeSidebarOrder(['home'])).not.toThrow()
  })
})
