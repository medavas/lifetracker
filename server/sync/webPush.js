import webpush from 'web-push'

/**
 * Wraps the `web-push` library with the one thing it doesn't do itself:
 * dropping subscriptions the browser has revoked. A 404/410 from the push
 * service means that endpoint is dead for good, not a transient failure --
 * anything else (offline device, rate limit) is left alone to retry next tick.
 *
 * Every outcome is logged. A silent failure here is indistinguishable from a
 * working system -- the runner advances its anchors either way -- so a 403
 * from mismatched VAPID keys once looked exactly like a delivered nudge.
 */
export function createPusher({ publicKey, privateKey, subject, subStore }) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
  console.log(`Push configured for VAPID key ${publicKey.slice(0, 12)}… subject ${subject}`)

  return async function pushToAll(body) {
    const subs = await subStore.all()
    if (subs.length === 0) {
      console.log(`Push "${body}": no subscriptions registered, nothing sent`)
      return
    }
    await Promise.all(
      subs.map(async (sub) => {
        try {
          const res = await webpush.sendNotification(sub, JSON.stringify({ title: 'Stoa', body }))
          console.log(`Push "${body}" -> ${sub.endpoint.slice(0, 50)}… accepted (${res.statusCode})`)
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await subStore.remove(sub.endpoint)
            console.log(`Push "${body}" -> subscription gone (${err.statusCode}), removed`)
            return
          }
          console.error(`Push "${body}" FAILED (${err.statusCode}): ${err.body || err.message}`)
        }
      }),
    )
  }
}
