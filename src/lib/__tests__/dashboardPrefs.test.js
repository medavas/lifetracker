import { describe, it, expect, afterEach, vi } from 'vitest'
import { readChartView, writeChartView } from '../dashboardPrefs.js'

const KEY = 'stoa.dashboardChartView'

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

describe('readChartView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to quarter with no stored value', () => {
    stubLocalStorage()
    expect(readChartView()).toBe('quarter')
  })

  it('defaults to quarter on a corrupt/unknown stored value', () => {
    const storage = stubLocalStorage()
    storage.setItem(KEY, 'nonsense')
    expect(readChartView()).toBe('quarter')
  })

  it('round-trips through writeChartView', () => {
    stubLocalStorage()
    writeChartView('week')
    expect(readChartView()).toBe('week')
  })
})

describe('writeChartView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('swallows a throwing setItem (quota) without propagating', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => {},
    })
    expect(() => writeChartView('week')).not.toThrow()
  })
})
