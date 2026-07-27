/**
 * Persistence layer.
 *
 * v1: local-first. All state lives in IndexedDB on this device via idb-keyval.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 🚩 DEPLOY / SYNC FLAG — this file is the swap point for phone↔desktop sync.
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

export const idbStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
}
