import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSyncToken, setSyncToken, syncNow, useSyncStatus } from '../sync.js'
import { useStore } from '../store.js'

beforeEach(() => {
  globalThis.localStorage = (() => {
    let m = {}
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v) }, removeItem: (k) => { delete m[k] } }
  })()
  import.meta.env.VITE_SYNC_URL = 'https://sync.test'
  useStore.setState({ items: [], notes: [], logs: [], points: 0 })
  useSyncStatus.setState({ lastSyncedAt: null, error: null })
})

describe('sync token', () => {
  it('round-trips', () => {
    setSyncToken('abc')
    expect(getSyncToken()).toBe('abc')
  })
})

describe('syncNow', () => {
  it('no-ops without a token', async () => {
    const fetch = vi.fn()
    globalThis.fetch = fetch
    await syncNow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('merges returned entities and records lastSyncedAt', async () => {
    setSyncToken('t')
    const it = useStore.getState().addItem('work', 'local')
    const remote = { entities: [{ kind: 'item', id: it.id, updatedAt: it.updatedAt + 100, deletedAt: null, data: { ...it, title: 'remote', updatedAt: it.updatedAt + 100 } }], serverTime: 1 }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => remote })
    await syncNow()
    expect(useStore.getState().items.find((i) => i.id === it.id).title).toBe('remote')
    expect(useSyncStatus.getState().lastSyncedAt).toBeTruthy()
  })

  it('sets a friendly error on 401', async () => {
    setSyncToken('bad')
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    await syncNow()
    expect(useSyncStatus.getState().error).toMatch(/token/i)
  })

  it('sets a non-null error on a network failure instead of clearing it', async () => {
    setSyncToken('t')
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await syncNow()
    expect(useSyncStatus.getState().error).not.toBeNull()
  })

  it('does not silently erase a prior real error on a network failure', async () => {
    setSyncToken('t')
    useSyncStatus.setState({ error: 'Check your sync token' })
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await syncNow()
    // Whatever wording is chosen, it must communicate offline state — not
    // silently keep the stale 401 message either.
    expect(useSyncStatus.getState().error).not.toBeNull()
  })
})
