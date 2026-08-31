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

// ── Fixed-time daily nudges ─────────────────────────────────────
// A nudge with `timeMin` (minutes since local midnight) instead of
// `intervalMin` fires once when the clock crosses that time each day --
// a deliberate alarm (wake-up, bedtime) rather than an ambient repeat.

/** Local calendar-day key -- used only to tell "already fired today" apart from "overdue from yesterday". */
const dateKey = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * What this tick should do for daily fixed-time nudges: fire (once) - ids to
 * notify; anchors - lastFired updates to persist.
 *
 * Deliberately takes no quiet-hours argument: unlike an interval nudge, a
 * clock-time nudge is something the user scheduled on purpose, possibly
 * INSIDE their own quiet window (a 6:30 wake-up inside 23:00-07:00 quiet
 * hours must still fire) -- quiet hours exist to hush ambient repeats
 * overnight, not to eat an alarm set for a specific time.
 *
 * Catch-up mirrors tickPlan's rule: if the app was closed at the scheduled
 * moment, it fires once next time it's open that day, not a backlog.
 */
export function dailyPlan(nudges, lastFired, now) {
  const today = dateKey(now)
  const d = new Date(now)
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const fire = []
  const anchors = {}
  for (const n of nudges) {
    if (!n.enabled || n.timeMin == null) continue
    if (nowMin < n.timeMin) continue
    const anchor = lastFired[n.id]
    if (anchor != null && dateKey(anchor) === today) continue
    anchors[n.id] = now
    fire.push(n.id)
  }
  return { fire, anchors }
}

/** When this daily nudge will next fire -- today's time if not yet fired today (even if already overdue), else tomorrow's. */
export function nextDailyFireAt(nudge, lastFired, now) {
  if (!nudge.enabled || nudge.timeMin == null) return null
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  const todayAt = base.getTime() + nudge.timeMin * MS_PER_MIN
  const anchor = lastFired[nudge.id]
  const firedToday = anchor != null && dateKey(anchor) === dateKey(now)
  return firedToday ? todayAt + 24 * 60 * MS_PER_MIN : todayAt
}

// ── Philosophy rotation ─────────────────────────────────────────
// One synthetic "nudge" that plays through your enabled Quotes/Principles in
// a shuffled daily order, spaced evenly across the minutes NOT covered by
// quiet hours. It deliberately reuses quiet-hours suppression (skip the
// notification, still advance the pointer) rather than a separate waking-
// hours setting, so it confines itself to waking hours for free.

/** Minutes of the local day outside the quiet-hours window (the window the rotation spreads across). */
export function wakingMinutes(quiet) {
  if (!quiet?.on) return 24 * 60
  const { startMin, endMin } = quiet
  const quietSpan = startMin > endMin ? (24 * 60 - startMin) + endMin : endMin - startMin
  return Math.max(0, 24 * 60 - quietSpan)
}

/** Fisher-Yates. The order only needs to vary day to day, not be reproducible, so plain Math.random is fine. */
export function shuffle(ids) {
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

/**
 * Rotation state is device-local and persists across ticks/app-restarts:
 * { day, order, index, anchor }. Reshuffles and resets whenever the local
 * day rolls over OR the enabled id set changes (a quote toggled on/off) --
 * a mid-day edit takes effect immediately instead of waiting for tomorrow.
 *
 * Interval is NOT stored -- it's recomputed every call from the current
 * waking-window length and item count, so toggling a quote on/off reshapes
 * the spacing of everything still enabled right away.
 */
export function philosophyPlan(enabledIds, state, quiet, now) {
  const today = dateKey(now)
  let { day, order, index, anchor } = state ?? {}
  if (day !== today || !order || !sameIds(order, enabledIds)) {
    order = shuffle(enabledIds)
    index = 0
    anchor = now
    day = today
  }
  if (order.length === 0) return { fire: null, state: { day, order, index: 0, anchor } }
  const interval = wakingMinutes(quiet) / order.length
  if (!(interval > 0) || now - anchor < interval * MS_PER_MIN) {
    return { fire: null, state: { day, order, index, anchor } }
  }
  const firedId = order[index % order.length]
  const nextState = { day, order, index: (index + 1) % order.length, anchor: now }
  return { fire: inQuietHours(now, quiet) ? null : firedId, state: nextState }
}

/** When the rotation will next play a quote, or null if it has no enabled items yet. */
export function nextPhilosophyFireAt(state, quiet) {
  if (!state?.order?.length) return null
  const interval = wakingMinutes(quiet) / state.order.length
  if (!(interval > 0) || state.anchor == null) return null
  return state.anchor + interval * MS_PER_MIN
}
