/**
 * Persistence layer.
 *
 * v1: local-first. All state lives in IndexedDB on this device via idb-keyval.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEPLOY / SYNC FLAG — this file is the swap point for phone/desktop sync.
 *
 * When you're ready to deploy (rdeyo site):
 *   1. Stand up the API (see server/ placeholder + README roadmap):
 *      Express + Mongo Atlas, bcrypt or WebAuthn at the door.
 *   2. Implement the same { getItem, setItem, removeItem } interface below
 *      against the API (remoteStorage), keeping idbStorage as the offline
 *      cache.
 *   3. Add a sync strategy: last-write-wins on a per-entity `updatedAt` is
 *      plenty for a single user on two devices. Push on change, pull on
 *      app focus.
 *   Nothing outside this file (and .env) should need to change.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { get, set, del } from 'idb-keyval'

// Rebrand (lifetracker -> stoa) renamed the persisted store key. Carry
// existing on-device data over the first time it's read under the new name.
const LEGACY_KEYS = { stoa: 'lifetracker' }

export const idbStorage = {
  getItem: async (name) => {
    const current = await get(name)
    if (current != null) return current
    const legacyKey = LEGACY_KEYS[name]
    if (!legacyKey) return null
    const legacy = await get(legacyKey)
    if (legacy == null) return null
    await set(name, legacy)
    return legacy
  },
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
}
