/**
 * Push subscription plumbing -- the counterpart to notify.js's local
 * Notification API, but for the sync server to reach a closed app. Every
 * browser global is read INSIDE a function, same reason as notify.js: the
 * vitest environment is `node`.
 */

const b64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = globalThis.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return Boolean(globalThis.navigator?.serviceWorker) && Boolean(globalThis.PushManager)
}

/** The subscription this device already holds, or null. */
export async function currentPushSubscription() {
  if (!pushSupported()) return null
  const reg = await globalThis.navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Subscribes this device and registers it with the sync server. Returns whether it succeeded. */
export async function subscribeToPush(vapidPublicKey, syncUrl, token) {
  if (!pushSupported() || !vapidPublicKey || !syncUrl || !token) return false
  const reg = await globalThis.navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToUint8Array(vapidPublicKey),
  })
  const res = await fetch(`${syncUrl}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  return res.ok
}

/** Unsubscribes this device locally and tells the server, best-effort. */
export async function unsubscribeFromPush(syncUrl, token) {
  const sub = await currentPushSubscription()
  if (!sub) return true
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  if (syncUrl && token) {
    await fetch(`${syncUrl}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {})
  }
  return true
}
