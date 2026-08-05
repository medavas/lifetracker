/**
 * Nudge scheduling -- pure. No DOM, no real clock, no storage: `now` and the
 * last-fired anchor map are always arguments, which is what makes every rule
 * below testable without fake timers.
 *
 * A nudge is an ITEM in the 'nudges' area carrying { intervalMin, enabled }.
 * `lastFired` maps item id to an epoch-ms anchor and is DEVICE-LOCAL -- if it
 * synced, a nudge firing on the phone would silently suppress the desktop.
 */

const MS_PER_MIN = 60_000

/** Quiet hours as minutes from local midnight. Wraps midnight by design. */
export const DEFAULT_QUIET = { on: true, startMin: 23 * 60, endMin: 7 * 60 }

/**
 * Whether `now` falls inside the quiet window. A window whose start is after
 * its end (the common case: 23:00-07:00) wraps past midnight, so the test
 * flips from AND to OR.
 */
export function inQuietHours(now, quiet) {
  if (!quiet || !quiet.on) return false
  const d = new Date(now)
  const mins = d.getHours() * 60 + d.getMinutes()
  const { startMin: start, endMin: end } = quiet
  return start > end ? mins >= start || mins < end : mins >= start && mins < end
}

/**
 * What this tick should do:
 *   fire    - ids to notify for right now
 *   anchors - lastFired updates to persist (empty when nothing changed)
 *
 * Two rules the caller must not re-implement:
 *
 * 1. Catch-up is suppressed. A nudge eight intervals overdue (laptop slept)
 *    fires ONCE and its anchor resets to `now`. Eight identical notifications
 *    is never the right answer.
 * 2. Quiet hours suppress the notification but STILL advance the anchor, so
 *    07:00 is not an avalanche of everything that came due overnight.
 *
 * A nudge with no anchor is never due on the tick it is first seen: it seeds
 * its anchor to `now` instead of firing. Toggling on locally already does
 * this via `seedAnchor`, but an `enabled:true` that arrives through sync
 * (another device toggled it on) has no local `lastFired` entry either --
 * without self-healing here it would stay dead on this device forever. So
 * "every 45m" means 45 minutes from whichever came first: the local toggle,
 * or the first tick this device saw the nudge enabled.
 */
export function tickPlan(nudges, lastFired, quiet, now) {
  const quietNow = inQuietHours(now, quiet)
  const fire = []
  const anchors = {}
  for (const n of nudges) {
    if (!n.enabled || !(n.intervalMin > 0)) continue
    const anchor = lastFired[n.id]
    if (anchor == null) {
      anchors[n.id] = now // first sighting on this device -- seed, do not fire
      continue
    }
    if (now - anchor < n.intervalMin * MS_PER_MIN) continue
    anchors[n.id] = now
    if (!quietNow) fire.push(n.id)
  }
  return { fire, anchors }
}

/** When this nudge is next due, or null if it is off or unanchored. */
export function nextFireAt(nudge, lastFired) {
  if (!nudge.enabled || !(nudge.intervalMin > 0)) return null
  const anchor = lastFired[nudge.id]
  if (anchor == null) return null
  return anchor + nudge.intervalMin * MS_PER_MIN
}
