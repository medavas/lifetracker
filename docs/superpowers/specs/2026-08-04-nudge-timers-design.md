# Nudges — interval timers with custom messages

Date: 2026-08-04

## Summary

A new area of **interval nudge timers**. Each nudge is a custom message plus a
minute interval and an on/off switch. Any nudge that is on fires its message on
its interval whenever Stoa is open. You dismiss it, the interval resets, and
nothing is recorded.

This is deliberately not a reminder system. There is no calendar recurrence, no
one-shot "remind me at 3pm", no logging, no points, and no graph band.

## Why this shape

The original ask was "local notifications I can set with custom messages" plus
an open question about repeat timers. Two constraints narrowed it:

1. **Foreground-only.** A web app can only fire a notification while something
   is running — either an open tab/PWA or a server pushing to it. Push requires
   a deployed always-on host, and `VITE_SYNC_URL` is empty in both `.env` and
   `.env.example`: the sync API has never been deployed. It only runs locally on
   :4000. Since having Stoa open is acceptable, v1 is pure client-side and needs
   no infrastructure at all.

2. **Interval only.** Of the three repeat shapes offered (clock-time recurrence,
   interval countdown, one-shot), only interval was wanted. That makes this a
   set of ambient nudges — "Water, every 2h", "Stand up, every 45m" — rather
   than a scheduler.

## Architecture

The app has 4 primitives, not 12 modules. This feature adds a new **area kind**
and reuses ITEM. It adds no new primitive and no new log kind.

### AREA — one new config row

In `src/data/areas.js`, new kind `'timers'`:

```js
{
  id: 'nudges', name: 'Nudges', icon: 'BellRing', kind: 'timers',
  trim: 'o',
  keywords: ['remind', 'nudge', 'timer', 'every', 'water', 'stretch'],
  buckets: [],
}
```

No `daily` field. Nudges are not a daily practice band, so `DAILY_BANDS`,
`rewards.js`, and `chart.js` are untouched — the stacked chart and practice grid
do not change at all.

### ITEM — one nudge

A nudge is an ITEM in the `nudges` area, reusing `title` as the notification
message body. Two new optional fields:

| Field         | Type    | Notes                                        |
| ------------- | ------- | -------------------------------------------- |
| `intervalMin` | number  | Integer minutes, 1–1440. Required for a nudge. |
| `enabled`     | boolean | Defaults `false` on create.                  |

`type: 'timer'`. Everything else is the standard ITEM shape.

**Architectural flag.** CLAUDE.md asks that anything wanting a 5th primitive be
flagged rather than built quietly. A nudge does carry new state — an interval
and an enabled flag — and this is the concession: two optional scalars on an
existing primitive, rather than a new store slice. `merge.js` carries the whole
entity `data` object through `asEntity`, so both fields sync across devices with
zero changes to the sync layer.

`enabled` is a separate field on purpose. It is **not** overloaded onto
`status`. Archiving is an explicit soft delete and switching a nudge off is not
archiving it, exactly as unchecking an item is not archiving it.

### LOG and NOTE — unused

Notify-only means there is nothing to record. No new log kind, no points, no
change to `computePoints`.

### Device-local state

Two pieces of state are **device-local and never synced**, stored in
`localStorage` alongside the existing `lifetracker.syncToken`:

| Key                   | Shape                     | Why local                                                                                        |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `stoa.nudge.lastFired` | `{ [itemId]: epochMs }`   | If it synced, a nudge firing on the phone would silently suppress the same nudge on the desktop. |
| `stoa.nudge.quiet`     | `{ start, end, on }`      | Quiet hours are a per-device preference, same as the sync token.                                 |

## Modules

| File                     | Responsibility                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/timers.js`      | **Pure.** Given nudges, a last-fired map, quiet-hours config, and `now`, returns which nudges are due and the next wake time. No DOM, no `setInterval`. |
| `src/lib/notify.js`      | Thin platform wrapper: permission request, `showNotification` via the service worker registration, feature detection. Keeps `timers.js` pure.          |
| `src/lib/nudgeRunner.js` | One `setInterval` tick for all nudges, started once from `App`. Asks `timers.js` what is due, hands the result to `notify.js`, writes back last-fired. |
| `src/views/Nudges.jsx`   | The area view: message, interval, on/off, next-fire countdown, permission state.                                                                       |

The split matters: all the logic that can be wrong lives in `timers.js`, which
is pure and fully testable without a DOM or fake clock plumbing. `notify.js` is
thin enough to have nothing worth testing; the runner is a loop that glues the
two together.

### Contracts

```js
// timers.js
dueNudges(nudges, lastFired, quiet, now) -> string[]   // item ids to fire now
nextWakeAt(nudges, lastFired, quiet, now) -> number|null

// notify.js
notifyPermission() -> 'granted' | 'denied' | 'default' | 'unsupported'
requestNotifyPermission() -> Promise<permission>       // must be called from a user gesture
fire(title, body) -> Promise<void>
```

## Behaviour

### Scheduling

- **Wall-clock anchored, not tick-counted.** A nudge is due when
  `now - lastFired[id] >= intervalMin * 60_000`. Background tabs throttle
  `setInterval` to roughly once a minute, so counting ticks would drift badly.
  Anchoring to timestamps means a throttled tab fires *late*, never *not at all*.
- **Tick cadence is 15 seconds.** It is a polling cadence, not a precision
  guarantee; the timestamp comparison is what makes it correct.
- **Enabling sets `lastFired[id] = now`**, so "every 45m" means 45 minutes from
  when it was switched on, not from an arbitrary anchor.
- **Disabling deletes the `lastFired` entry** so re-enabling starts a fresh
  interval rather than firing immediately.
- **Catch-up is suppressed.** If the laptop sleeps six hours, a 45-minute nudge
  wakes eight intervals overdue. It fires **once** and resets its anchor to now.
  A burst of eight identical notifications is never correct.

### Quiet hours

A single global window, stored per device, **defaulting to 23:00–07:00 and on**.

- The window wraps midnight, so the check is `start > end ? (t >= start || t < end) : (t >= start && t < end)`.
- Nudges due inside the window are **suppressed, not deferred** — they do not
  accumulate and do not all fire at 07:00. The anchor advances as if the nudge
  had fired, so the next one lands one interval later.
- An always-on interval timer without this will wake you at 3am. It is a
  correctness requirement, not a nicety.

### Permission

Requested on the **first toggle-on**, from that user gesture — never on app
load. iOS requires a gesture, and asking on load is the reliable way to get
permanently denied.

### Notification content

Title is `Stoa`, body is the nudge's `title` (the custom message). No actions,
no snooze — that was explicitly cut. `tag` is set to the item id so repeated
fires of the same nudge replace rather than stack.

## Routing

`AreasGrid` currently picks a destination with a ternary chain on `kind`
(`journal` → `/journal`, `habits` → `/habits`, else `/area/:id`). Adding a
fourth kind makes that chain the wrong shape.

**Targeted improvement, in scope:** add an optional `route` field to the area
config and have `AreasGrid` resolve a destination as:

```js
const routeFor = (a) => a.route ?? `/area/${a.id}`
```

Journal, Habits, and Nudges each declare their own route in one place, and the
ternary chain goes away. This is the same
"adding an area is adding a config row" principle the registry already states,
and it is three lines rather than a refactor.

New route in `App.jsx`: `/nudges` → `Nudges`. Not added to `BottomNav` — that
bar has six entries already and nudges are a set-and-forget surface reached
through Areas.

## Failure handling

Every failure mode resolves to a visible state in the Nudges view. A nudge
switched on but silently doing nothing is the worst possible outcome.

| Condition                              | Behaviour                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No `Notification` API                  | View shows "This browser can't show notifications." Toggles disabled.                          |
| Permission denied                      | View shows the blocked state and how to re-enable it in browser settings. Nudges can still be created and toggled on — the view states plainly that nothing will fire until permission is granted — so the list is configurable ahead of time rather than frozen. |
| Permission still `default`             | Toggling on triggers the request; if dismissed, the nudge stays off.                           |
| Service worker not yet registered      | Fall back to the `new Notification()` constructor where available.                              |
| iOS Safari, not installed to home screen | Detect and say so — notification permission is unavailable to an uninstalled PWA on iOS.       |

## Testing

`src/lib/__tests__/timers.test.js`, covering the pure module:

- A nudge past its interval is due; one inside its interval is not.
- Disabled nudges are never due.
- A nudge with no `lastFired` entry is not due (enabling seeds the anchor).
- Catch-up: eight intervals overdue fires once, and the anchor resets to `now`.
- Quiet hours suppress a due nudge, and the anchor still advances.
- Quiet hours wrapping midnight: 23:30 and 06:30 are inside, 08:00 and 22:00 are not.
- Quiet hours off means no suppression.
- `nextWakeAt` returns the earliest upcoming fire, and `null` when nothing is enabled.

`notify.js` is mocked in a runner test that asserts the runner fires exactly the
ids `dueNudges` returns and writes back their anchors.

**Regression bar:** the existing `rewards.test.js` and `chart.test.js` must pass
unchanged. That is the proof this feature did not leak into the daily graph.

## Out of scope

Daily and weekly clock recurrence · one-shot reminders · snooze · logging,
points, or a Nudges band on the daily graph · Web Push · deploying the sync API.

## Appendix — the other three features

This spec is one of four decomposed from a single request. The other three are
independent and each gets its own spec, plan, and implementation cycle. Recorded
here so the findings are not lost:

**Fitness top priorities.** A customizable daily checklist feeding the daily
graph. There is a real bug underneath the ask: `countsForDate` in `rewards.js`
counts the fitness band from `complete|fitness` logs, and a one-shot task
completes exactly once — so a fitness item can contribute to the chart once in
its lifetime and never again. The fix is fitness items that behave like habits
(`habit-check` logs), which means the `kind` switch in `countsForDate` needs a
way to treat habit-typed items inside a `list` area.

**Projects delinearized.** Project-as-container with per-project notes and a
sidebar for selecting and editing individual projects. `kind: 'library'` already
means "items that carry their own notes", so the data is mostly there; the new
work is the master-detail layout, not the schema.

**Journal monthly-first navigation.** Year → month → day drilldown, month view
opening scrolled to the bottom (current), past days read-only, composing only
for today. A pure view rework over the NOTEs and `kind:'journal'` LOGs that
already exist. No schema change.
