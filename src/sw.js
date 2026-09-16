import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

// Matches the behavior generateSW gave us under registerType: 'autoUpdate' --
// injectManifest hands us the whole service worker body, so nothing does
// this for free anymore.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let payload = { title: 'Stoa', body: '' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // Non-JSON payload -- fall back to the empty default body.
  }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, tag: payload.tag }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
