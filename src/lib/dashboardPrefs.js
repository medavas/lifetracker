/**
 * Device-local dashboard UI preference: which tab the activity chart was
 * left on. A UI preference, not domain data -- lives in localStorage like
 * the sidebar order and the nudge quiet-hours window, never synced, never
 * a store primitive.
 */
const KEY = 'stoa.dashboardChartView'

export const CHART_VIEWS = ['week', 'quarter']
const DEFAULT_VIEW = 'quarter'

export function readChartView() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    return CHART_VIEWS.includes(raw) ? raw : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

export function writeChartView(view) {
  try {
    globalThis.localStorage?.setItem(KEY, view)
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}
