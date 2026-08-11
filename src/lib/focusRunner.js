/**
 * Focus timer orchestration -- ticks the pure focusTimer.js logic and owns
 * the two pieces of device-local state (settings, in-progress countdown).
 * Modeled on lib/nudgeRunner.js: injected getState/setState/getSettings/now/
 * fire keep tick() testable without a DOM, a real clock, or localStorage.
 */
import { isDue, advance, MODES, DEFAULT_SETTINGS, IDLE_STATE } from './focusTimer'

export const TICK_MS = 1000

function messageFor(mode) {
  if (mode === MODES.WORK) return "Break's over — back to it"
  if (mode === MODES.LONG_BREAK) return 'Nice work — take a longer break'
  return 'Work session done — take a break'
}

/**
 * `fire` and `onWorkComplete` are only called when a phase genuinely
 * completes on this tick -- never on every call, never more than once per
 * completed phase (see focusTimer.js's advance() for why a state overdue by
 * hours still only advances one phase per tick).
 */
export function createFocusRunner({ getState, setState, getSettings, now, fire, onWorkComplete }) {
  function tick() {
    const state = getState()
    const n = now()
    if (!isDue(state, n)) return state
    const completedMode = state.mode
    const next = advance(state, getSettings(), n)
    setState(next)
    if (completedMode === MODES.WORK) onWorkComplete?.()
    fire?.(messageFor(next.mode))
    return next
  }
  return { tick }
}

// ── Device-local storage ────────────────────────────────────────
const SETTINGS_KEY = 'stoa.focusSettings'
const STATE_KEY = 'stoa.focusState'

function readJson(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private-mode quota errors are not worth taking the app down for.
  }
}

export const readSettings = () => readJson(SETTINGS_KEY, DEFAULT_SETTINGS)
export const writeSettings = (settings) => writeJson(SETTINGS_KEY, settings)

export const readState = () => readJson(STATE_KEY, IDLE_STATE)
export const writeState = (state) => writeJson(STATE_KEY, state)
