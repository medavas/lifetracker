/**
 * One interval drives every nudge — not one timer per nudge.
 *
 * `createRunner` takes all its dependencies as arguments so the loop can be
 * tested under the node environment with plain objects. The localStorage-backed
 * wiring below it is only reached from `startNudges()`, which tests never call.
 */
import { tickPlan, DEFAULT_QUIET } from './timers.js'
import { fireNotification } from './notify.js'
import { useStore, selectAreaItems } from './store.js'

/** Polling cadence. Correctness comes from timestamp comparison, not this. */
export const TICK_MS = 15_000

export function createRunner({ getNudges, getLastFired, setLastFired, getQuiet, fire, now }) {
  return {
    tick() {
      const nudges = getNudges()
      const plan = tickPlan(nudges, getLastFired(), getQuiet(), now())
      if (Object.keys(plan.anchors).length === 0) return plan
      // Persist BEFORE firing: if `fire` throws or the permission was revoked,
      // the anchor has still moved, so the next tick cannot re-fire in a loop.
      setLastFired({ ...getLastFired(), ...plan.anchors })
      const byId = new Map(nudges.map((n) => [n.id, n]))
      for (const id of plan.fire) {
        Promise.resolve(fire(byId.get(id).title, id)).catch(() => {})
      }
      return plan
    },
  }
}

// ── Device-local storage ────────────────────────────────────────
// Anchors and quiet hours never sync. A synced anchor would mean the phone
// firing a nudge silently suppresses the same nudge on the desktop.

const LAST_KEY = 'stoa.nudge.lastFired'
const QUIET_KEY = 'stoa.nudge.quiet'

const readJson = (key, fallback) => {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}

export const readLastFired = () => readJson(LAST_KEY, {})
export const writeLastFired = (map) => writeJson(LAST_KEY, map)

/** Switching a nudge on starts its interval from now, not from some old anchor. */
export const seedAnchor = (id) => writeLastFired({ ...readLastFired(), [id]: Date.now() })

/** Switching one off drops its anchor, so re-enabling never fires immediately. */
export const clearAnchor = (id) => {
  const next = { ...readLastFired() }
  delete next[id]
  writeLastFired(next)
}

export const readQuiet = () => ({ ...DEFAULT_QUIET, ...readJson(QUIET_KEY, {}) })
export const writeQuiet = (quiet) => writeJson(QUIET_KEY, quiet)

/** Start the single app-wide tick. Returns a cleanup function. */
export function startNudges() {
  const runner = createRunner({
    getNudges: () => selectAreaItems('nudges')(useStore.getState()),
    getLastFired: readLastFired,
    setLastFired: writeLastFired,
    getQuiet: readQuiet,
    fire: fireNotification,
    now: Date.now,
  })
  const id = setInterval(() => runner.tick(), TICK_MS)
  return () => clearInterval(id)
}
