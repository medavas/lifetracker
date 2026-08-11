import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createFocusRunner, TICK_MS,
  readSettings, writeSettings, readState, writeState,
} from '../focusRunner.js'
import { DEFAULT_SETTINGS, MODES, IDLE_STATE, start } from '../focusTimer.js'

const MIN = 60_000
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

/** Wires createFocusRunner to plain in-memory refs instead of localStorage. */
const harness = ({ state, settings = DEFAULT_SETTINGS, now }) => {
  let current = state
  const fired = []
  const completions = []
  const runner = createFocusRunner({
    getState: () => current,
    setState: (next) => { current = next },
    getSettings: () => settings,
    now: () => now,
    fire: (body) => fired.push(body),
    onWorkComplete: () => completions.push(true),
  })
  return { runner, fired, completions, state: () => current }
}

describe('createFocusRunner', () => {
  it('ticks every second', () => {
    expect(TICK_MS).toBe(1000)
  })

  it('does nothing when the state is not due', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 10 * MIN })
    h.runner.tick()
    expect(h.state()).toBe(running)
    expect(h.fired).toEqual([])
    expect(h.completions).toEqual([])
  })

  it('does nothing when idle or paused, however much time has passed', () => {
    const h = harness({ state: IDLE_STATE, now: at(12) + 999 * MIN })
    h.runner.tick()
    expect(h.state()).toBe(IDLE_STATE)
  })

  it('advances a due work phase to its break and fires a notification', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 25 * MIN })
    h.runner.tick()
    expect(h.state().mode).toBe(MODES.SHORT_BREAK)
    expect(h.fired).toHaveLength(1)
  })

  it('calls onWorkComplete only when the phase that just finished was work', () => {
    const now = at(12)
    const runningBreak = start({ ...IDLE_STATE, mode: MODES.SHORT_BREAK }, DEFAULT_SETTINGS, now)
    const h = harness({ state: runningBreak, now: now + 5 * MIN })
    h.runner.tick()
    expect(h.state().mode).toBe(MODES.WORK)
    expect(h.completions).toEqual([])
  })

  it('calls onWorkComplete exactly once when a work phase finishes', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const h = harness({ state: running, now: now + 25 * MIN })
    h.runner.tick()
    expect(h.completions).toEqual([true])
    h.runner.tick() // not due again immediately
    expect(h.completions).toEqual([true])
  })
})

// ── Device-local storage ────────────────────────────────────────
const SETTINGS_KEY = 'stoa.focusSettings'
const STATE_KEY = 'stoa.focusState'

const stubLocalStorage = () => {
  const map = new Map()
  const storage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('device-local storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('readSettings falls back to defaults with nothing stored', () => {
    stubLocalStorage()
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('writeSettings round-trips through readSettings', () => {
    stubLocalStorage()
    writeSettings({ ...DEFAULT_SETTINGS, workMin: 50 })
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, workMin: 50 })
  })

  it('readSettings merges a partial stored config over the defaults', () => {
    const storage = stubLocalStorage()
    storage.setItem(SETTINGS_KEY, JSON.stringify({ workMin: 50 }))
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, workMin: 50 })
  })

  it('readSettings returns defaults on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(SETTINGS_KEY, '{not json')
    expect(readSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('readState falls back to IDLE_STATE with nothing stored', () => {
    stubLocalStorage()
    expect(readState()).toEqual(IDLE_STATE)
  })

  it('writeState round-trips through readState', () => {
    stubLocalStorage()
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, at(12))
    writeState(running)
    expect(readState()).toEqual(running)
  })

  it('readState returns IDLE_STATE on corrupt JSON', () => {
    const storage = stubLocalStorage()
    storage.setItem(STATE_KEY, '{not json')
    expect(readState()).toEqual(IDLE_STATE)
  })
})
