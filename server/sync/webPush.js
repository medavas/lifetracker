import webpush from 'web-push'

/**
 * Wraps the `web-push` library with the one thing it doesn't do itself:
 * dropping subscriptions the browser has revoked. A 404/410 from the push
 * service means that endpoint is dead for good, not a transient failure --
 * anything else (offline device, rate limit) is left alone to retry next tick.
 */
export function createPusher({ publicKey, privateKey, subject, subStore }) {
  webpush.setVapidDetails(subject, publicKey, privateKey)

  return async function pushToAll(body) {
    const subs = await subStore.all()
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, JSON.stringify({ title: 'Stoa', body }))
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) await subStore.remove(sub.endpoint)
        }
      }),
    )
  }
}
