/**
 * Device-local sidebar/bottom-nav personalization. A UI preference, not
 * domain data -- lives in localStorage like the sync token and the nudge
 * quiet-hours window, never synced, never a store primitive. The saved
 * order drives both the desktop sidebar's link order and, on phone, which
 * four destinations get a bottom-bar button (the top 4).
 *
 * Settings is deliberately absent from the orderable set: it is pinned in
 * the sidebar's top section and never appears on the bottom bar, regardless
 * of anything the user does here.
 */
import { AREAS, areaById, routeFor } from '../data/areas'

const KEY = 'stoa.sidebarOrder'

export const HOME_ENTRY = { id: 'home', name: 'Home', icon: 'House', route: '/' }
export const AREAS_GRID_ENTRY = { id: 'areas', name: 'Areas', icon: 'LayoutGrid', route: '/areas' }
export const SETTINGS_ENTRY = { id: 'settings', name: 'Settings', icon: 'Settings', route: '/settings' }

/**
 * The sidebar's top section: fixed, unrankable, and never repeated in the
 * main menu below it.
 */
export const PINNED_IDS = ['home', 'nudges', 'areas', 'settings']

/** The pinned top-section destinations, in their fixed order. */
export function pinnedEntries() {
  const nudges = areaById('nudges')
  const byId = {
    nudges: nudges && { id: nudges.id, name: nudges.name, icon: nudges.icon, route: routeFor(nudges) },
    home: HOME_ENTRY,
    settings: SETTINGS_ENTRY,
    areas: AREAS_GRID_ENTRY,
  }
  return PINNED_IDS.map((id) => byId[id]).filter(Boolean)
}

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

/** orderableEntries() sorted per the saved order. Drives the bottom bar's top 4. */
export function orderedEntries() {
  const order = readSidebarOrder()
  const byId = new Map(orderableEntries().map((e) => [e.id, e]))
  return order.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * The sidebar's main menu: the saved order minus everything the top section
 * already pins. A pinned destination is still rankable (its rank decides its
 * bottom-bar slot on phone) — it just never appears twice in the drawer.
 */
export function mainMenuEntries() {
  return orderedEntries().filter((e) => !PINNED_IDS.includes(e.id))
}
