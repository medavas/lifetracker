import { useEffect, useRef } from 'react'

/**
 * Makes the phone's system Back button dismiss an overlay instead of leaving
 * the page (which on a PWA means losing whatever was typed into it).
 *
 * While the overlay is up, one sentinel history entry stands in for it, so
 * Back pops that entry and runs `onDismiss` — which for an edit sheet is its
 * own Save, not a discard. The router never sees a location change: the
 * sentinel keeps the same URL and copies the router's own `idx`, so its
 * popstate handler computes delta 0 and does nothing (dropping `idx` would
 * corrupt the router's index bookkeeping for every later push).
 *
 * Closing by any other route (backdrop, Save, Delete) unwinds the sentinel so
 * Back never needs pressing twice. That unwind is deferred a tick and can be
 * claimed by the next mount, because StrictMode mounts every effect twice:
 * unwinding synchronously in the first cleanup pops the sentinel out from
 * under the second mount, and the resulting popstate reads as a Back press —
 * every sheet closed itself the instant it opened.
 */
let pendingUnwind = 0

export function useBackDismiss(onDismiss, active = true) {
  const handler = useRef(onDismiss)
  handler.current = onDismiss

  useEffect(() => {
    if (!active) return undefined

    if (pendingUnwind > 0) pendingUnwind-- // reuse the sentinel this remount was about to drop
    else window.history.pushState({ ...window.history.state, stoaOverlay: true }, '')

    let dismissedByBack = false
    const onPop = () => {
      dismissedByBack = true
      handler.current()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      if (dismissedByBack) return
      pendingUnwind++
      setTimeout(() => {
        if (pendingUnwind === 0) return
        pendingUnwind--
        // A close that also navigated has already replaced the sentinel;
        // going back then would undo that navigation.
        if (window.history.state?.stoaOverlay) window.history.back()
      }, 0)
    }
  }, [active])
}
