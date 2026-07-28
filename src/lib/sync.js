import { create } from 'zustand'
import { useStore } from './store'
import { toEntities } from './merge'

const TOKEN_KEY = 'lifetracker.syncToken'

export const getSyncToken = () => localStorage.getItem(TOKEN_KEY)
export const setSyncToken = (t) => localStorage.setItem(TOKEN_KEY, t)

export const useSyncStatus = create(() => ({ lastSyncedAt: null, error: null }))

const baseUrl = () => import.meta.env.VITE_SYNC_URL || ''

// Set while syncNow() is applying a remote pull via mergeRemote(), so the
// store-change subscriber in startSync() can tell "the store changed
// because a remote pull just merged in" apart from a genuine local edit.
// Without this, every successful syncNow() would trigger mergeRemote's
// set(...), which fires the subscriber, which schedules another debounced
// syncNow() ~1500ms later — forever, even with zero local edits. That turns
// "push on local change" into indefinite polling, contradicting the
// no-realtime design intent.
let applyingRemote = false

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
    applyingRemote = true
    try {
      useStore.getState().mergeRemote(body.entities || [])
    } finally {
      applyingRemote = false
    }
    useSyncStatus.setState({ lastSyncedAt: Date.now(), error: null })
  } catch {
    // Offline / unreachable — stay local, retry on next focus/online, but
    // say so: leaving `error` null here would hide a real outage (and could
    // silently paper over a still-broken token if a network hiccup lands
    // right after a 401).
    useSyncStatus.setState({ error: 'Offline — will retry' })
  }
}

let started = false
export function startSync() {
  if (started) return () => {}
  started = true

  let timer = null
  const push = () => {
    if (applyingRemote) return // remote-applied change, not a local edit — don't reschedule
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
