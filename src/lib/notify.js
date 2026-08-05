/**
 * The only module that touches the Notification API. Keeping it here is what
 * lets timers.js stay pure and the nudge runner be tested with a fake `fire`.
 *
 * Every browser global is read INSIDE a function via globalThis, never at
 * module top level, because the vitest environment is `node` -- a top-level
 * `Notification` reference would throw on import.
 */

export const UNSUPPORTED = 'unsupported'

/** 'granted' | 'denied' | 'default' | 'unsupported'. */
export function notifyPermission() {
  const N = globalThis.Notification
  return N ? N.permission : UNSUPPORTED
}

/**
 * Must be called from a user gesture -- iOS requires it, and asking on app
 * load is the reliable way to get permanently denied.
 */
export async function requestNotifyPermission() {
  const N = globalThis.Notification
  if (!N) return UNSUPPORTED
  return N.requestPermission()
}

/**
 * Show one notification. Prefers the service worker registration (the only
 * path that works for an installed PWA) and falls back to the constructor.
 * `tag` is the nudge's item id, so repeat fires replace rather than stack.
 * Returns whether anything was actually shown.
 */
export async function fireNotification(body, tag) {
  if (notifyPermission() !== 'granted') return false
  const reg = await globalThis.navigator?.serviceWorker?.getRegistration?.()
  if (reg) {
    await reg.showNotification('Stoa', { body, tag })
    return true
  }
  new globalThis.Notification('Stoa', { body, tag })
  return true
}
