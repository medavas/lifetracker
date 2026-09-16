import { tickPlan, dailyPlan } from '../../src/lib/timers.js'

/**
 * The server-side counterpart to src/lib/nudgeRunner.js's createRunner --
 * same tickPlan/dailyPlan rules, so a nudge behaves identically whether it
 * fires locally in an open tab or via push from here. Two differences:
 *
 * - No philosophy rotation. That needs a synced "rotation is on" flag, which
 *   doesn't exist yet (readPhilosophyOn is device-local by design) -- adding
 *   one is a real feature, not a line item here.
 * - Every getter/setter may be async (Mongo), where the client's are sync
 *   (localStorage), so this always awaits them.
 */
export function createPushRunner({ getNudges, getLastFired, setLastFired, getQuiet, sendPush, now }) {
  return {
    async tick() {
      const nudges = await getNudges()
      const lastFired = await getLastFired()
      const quiet = await getQuiet()
      const t = now()
      const byId = new Map(nudges.map((n) => [n.id, n]))

      const interval = tickPlan(nudges, lastFired, quiet, t)
      const daily = dailyPlan(nudges, lastFired, t)
      const anchors = { ...interval.anchors, ...daily.anchors }
      if (Object.keys(anchors).length > 0) await setLastFired({ ...lastFired, ...anchors })

      const fire = [...interval.fire, ...daily.fire]
      for (const id of fire) {
        await sendPush(byId.get(id).title).catch(() => {})
      }
      return { fire, anchors }
    },
  }
}
