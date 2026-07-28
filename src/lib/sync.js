import { create } from 'zustand'
import { useStore } from './store'
import { toEntities } from './merge'

const TOKEN_KEY = 'lifetracker.syncToken'

export const getSyncToken = () => localStorage.getItem(TOKEN_KEY)
export const setSyncToken = (t) => localStorage.setItem(TOKEN_KEY, t)

export const useSyncStatus = create(() => ({ lastSyncedAt: null, error: null }))

const baseUrl = () => import.meta.env.VITE_SYNC_URL || ''

export async function syncNow() {
  const token = getSyncToken()
  const url = baseUrl()
  if (!token || !url) return

  const { items, notes, logs } = useStore.getState()
  try {
    const res = await fetch(`${url}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entities: toEntities({ items, notes, logs }) }),
    })
    if (res.status === 401) {
      useSyncStatus.setState({ error: 'Check your sync token' })
      return
    }
    if (!res.ok) {
      useSyncStatus.setState({ error: `Sync failed (${res.status})` })
      return
    }
    const body = await res.json()
    useStore.getState().mergeRemote(body.entities || [])
    useSyncStatus.setState({ lastSyncedAt: Date.now(), error: null })
  } catch {
    // Offline / unreachable — stay local, retry on next focus/online.
    useSyncStatus.setState({ error: null })
  }
}

let started = false
export function startSync() {
  if (started) return () => {}
  started = true

  let timer = null
  const push = () => {
    clearTimeout(timer)
    timer = setTimeout(syncNow, 1500)
  }
  const unsub = useStore.subscribe(push)
  const pull = () => syncNow()
  window.addEventListener('focus', pull)
  window.addEventListener('online', pull)
  syncNow() // initial pull

  return () => {
    started = false
    clearTimeout(timer)
    unsub()
    window.removeEventListener('focus', pull)
    window.removeEventListener('online', pull)
  }
}
