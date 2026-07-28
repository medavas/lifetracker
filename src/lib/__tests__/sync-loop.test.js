// startSync() touches `window` for its focus/online listeners. The project
// runs tests under vitest's `node` environment (no jsdom/happy-dom
// dependency installed — see vitest.config.js), so this file stubs a
// minimal `window` rather than pulling in a DOM environment just for two
// addEventListener/removeEventListener calls.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setSyncToken, startSync, useSyncStatus } from '../sync.js'
import { useStore } from '../store.js'

beforeEach(async () => {
  globalThis.localStorage = (() => {
    let m = {}
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v) }, removeItem: (k) => { delete m[k] } }
  })()
  import.meta.env.VITE_SYNC_URL = 'https://sync.test'
  // Drain the persist middleware's own async IndexedDB rehydration (real
  // timers/microtasks) *before* switching to fake timers below — otherwise
  // that unrelated hydration set() can land mid-test, itself fire the
  // subscribe(push) callback with applyingRemote=false, and schedule a
  // spurious extra debounced sync that has nothing to do with what this
  // suite is testing.
  await useStore.persist.rehydrate()
  useStore.setState({ items: [], notes: [], logs: [], points: 0 })
  useSyncStatus.setState({ lastSyncedAt: null, error: null })
  globalThis.window = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.window
})

describe('startSync — remote-merge feedback loop', () => {
  it('does not schedule another push after a pull merges remote state (no local edits)', async () => {
    setSyncToken('t')
    const item = useStore.getState().addItem('work', 'local')
    const remote = {
      entities: [
        {
          kind: 'item',
          id: item.id,
          updatedAt: item.updatedAt + 100,
          deletedAt: null,
          data: { ...item, title: 'remote', updatedAt: item.updatedAt + 100 },
        },
      ],
      serverTime: 1,
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => remote })
    globalThis.fetch = fetchMock

    const stop = startSync()
    try {
      // Flush the initial pull's fetch/json/mergeRemote microtask chain.
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(useStore.getState().items.find((i) => i.id === item.id).title).toBe('remote')

      // If mergeRemote's own set(...) mistakenly re-armed the debounce,
      // this would fire a second fetch call.
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it('still schedules a debounced push for a genuine local edit', async () => {
    setSyncToken('t')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entities: [] }) })
    globalThis.fetch = fetchMock

    const stop = startSync()
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1) // initial pull

      useStore.getState().addItem('work', 'a real local edit')
      await vi.advanceTimersByTimeAsync(1500)
      expect(fetchMock).toHaveBeenCalledTimes(2) // debounced push fired
    } finally {
      stop()
    }
  })
})
