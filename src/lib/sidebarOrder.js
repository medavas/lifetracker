/**
 * Device-local sidebar/bottom-nav personalization. A UI preference, not
 * domain data -- lives in localStorage like the sync token and the nudge
 * quiet-hours window, never synced, never a store primitive. The saved
 * order drives both the desktop sidebar's link order and, on phone, which
 * four destinations get a bottom-bar button (the top 4).
 *
 * Settings is deliberately absent from the orderable set: it is pinned at
 * the bottom of the sidebar and never appears on the bottom bar, regardless
 * of anything the user does here.
 */
import { AREAS, routeFor } from '../data/areas'

const KEY = 'stoa.sidebarOrder'

export const HOME_ENTRY = { id: 'home', name: 'Home', icon: 'House', route: '/' }
export const AREAS_GRID_ENTRY = { id: 'areas', name: 'Areas', icon: 'LayoutGrid', route: '/areas' }

/** Every destination the user can rank: Home, the Areas grid, then all 10 areas. */
export function orderableEntries() {
  return [
    HOME_ENTRY,
    AREAS_GRID_ENTRY,
    ...AREAS.map((a) => ({ id: a.id, name: a.name, icon: a.icon, route: routeFor(a) })),
  ]
}

const defaultOrder = () => orderableEntries().map((e) => e.id)

function readOrderIds() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeSidebarOrder(ids) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}

/**
 * The user's saved order, reconciled against the current entry set: a
 * stale id (an area since removed) is dropped, a new id (an area since
 * added) is appended at the end in the default order's relative order --
 * so this never silently loses a destination or breaks on a shape it
 * doesn't recognize (corrupt JSON, an old save from before an area existed).
 */
export function readSidebarOrder() {
  const valid = new Set(defaultOrder())
  const stored = readOrderIds()
  if (!stored) return defaultOrder()
  const kept = stored.filter((id) => valid.has(id))
  const missing = defaultOrder().filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}

/** orderableEntries() sorted per the saved order. */
export function orderedEntries() {
  const order = readSidebarOrder()
  const byId = new Map(orderableEntries().map((e) => [e.id, e]))
  return order.map((id) => byId.get(id)).filter(Boolean)
}
