import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS, MODES, IDLE_STATE,
  phaseDurationMs, nextPhase, remainingMs, isDue, start, pause, reset, advance,
} from '../focusTimer.js'

const MIN = 60_000
const at = (h, m = 0) => new Date(2026, 7, 4, h, m, 0, 0).getTime()

describe('phaseDurationMs', () => {
  it('maps each mode to its configured minutes', () => {
    expect(phaseDurationMs(MODES.WORK, DEFAULT_SETTINGS)).toBe(25 * MIN)
    expect(phaseDurationMs(MODES.SHORT_BREAK, DEFAULT_SETTINGS)).toBe(5 * MIN)
    expect(phaseDurationMs(MODES.LONG_BREAK, DEFAULT_SETTINGS)).toBe(15 * MIN)
  })
})

describe('nextPhase', () => {
  it('sends a work round before the last into a short break, same round number', () => {
    expect(nextPhase(MODES.WORK, 1, DEFAULT_SETTINGS)).toEqual({ mode: MODES.SHORT_BREAK, round: 1 })
    expect(nextPhase(MODES.WORK, 3, DEFAULT_SETTINGS)).toEqual({ mode: MODES.SHORT_BREAK, round: 3 })
  })

  it('sends the last work round of the cycle into a long break', () => {
    expect(nextPhase(MODES.WORK, 4, DEFAULT_SETTINGS)).toEqual({ mode: MODES.LONG_BREAK, round: 4 })
  })

  it('sends a short break back to work, incrementing the round', () => {
    expect(nextPhase(MODES.SHORT_BREAK, 1, DEFAULT_SETTINGS)).toEqual({ mode: MODES.WORK, round: 2 })
  })

  it('sends a long break back to work, resetting the round to 1', () => {
    expect(nextPhase(MODES.LONG_BREAK, 4, DEFAULT_SETTINGS)).toEqual({ mode: MODES.WORK, round: 1 })
  })

  it('honors a non-default roundsBeforeLongBreak', () => {
    const settings = { ...DEFAULT_SETTINGS, roundsBeforeLongBreak: 2 }
    expect(nextPhase(MODES.WORK, 2, settings)).toEqual({ mode: MODES.LONG_BREAK, round: 2 })
  })
})

describe('start / pause / remainingMs / isDue', () => {
  it('start seeds remainingMs from settings when the state is idle', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(running).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 25 * MIN, runningSince: now })
  })

  it('remainingMs counts down from runningSince while running', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(remainingMs(running, now + 10 * MIN)).toBe(15 * MIN)
  })

  it('remainingMs never goes negative', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(remainingMs(running, now + 999 * MIN)).toBe(0)
  })

  it('pause freezes the countdown into remainingMs and clears runningSince', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const paused = pause(running, now + 10 * MIN)
    expect(paused).toEqual({ mode: MODES.WORK, round: 1, status: 'paused', remainingMs: 15 * MIN, runningSince: null })
    // frozen regardless of how much later `now` advances
    expect(remainingMs(paused, now + 999 * MIN)).toBe(15 * MIN)
  })

  it('pausing a state that is not running is a no-op', () => {
    expect(pause(IDLE_STATE, at(12))).toEqual(IDLE_STATE)
  })

  it('start resumes a paused state from its frozen remainingMs, not a fresh duration', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const paused = pause(running, now + 10 * MIN)
    const resumed = start(paused, DEFAULT_SETTINGS, now + 60 * MIN)
    expect(resumed).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 15 * MIN, runningSince: now + 60 * MIN })
  })

  it('isDue is false until remaining time hits zero, then true', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    expect(isDue(running, now + 24 * MIN + 59_000)).toBe(false)
    expect(isDue(running, now + 25 * MIN)).toBe(true)
  })

  it('an idle or paused state is never due', () => {
    expect(isDue(IDLE_STATE, at(12))).toBe(false)
    const paused = pause(start(IDLE_STATE, DEFAULT_SETTINGS, at(12)), at(12, 10))
    expect(isDue(paused, at(23))).toBe(false)
  })
})

describe('reset', () => {
  it('returns an idle work phase at round 1, seeded from settings', () => {
    expect(reset(DEFAULT_SETTINGS)).toEqual({
      mode: MODES.WORK, round: 1, status: 'idle', remainingMs: 25 * MIN, runningSince: null,
    })
  })

  it('reflects a custom workMin', () => {
    expect(reset({ ...DEFAULT_SETTINGS, workMin: 50 }).remainingMs).toBe(50 * MIN)
  })
})

describe('advance', () => {
  it('moves a due running work phase into its short break, still running', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const due = now + 25 * MIN
    const next = advance(running, DEFAULT_SETTINGS, due)
    expect(next).toEqual({
      mode: MODES.SHORT_BREAK, round: 1, status: 'running', remainingMs: 5 * MIN, runningSince: due,
    })
  })

  it('moves the 4th work round into a long break', () => {
    const now = at(12)
    const running = start({ ...IDLE_STATE, round: 4 }, DEFAULT_SETTINGS, now)
    const next = advance(running, DEFAULT_SETTINGS, now + 25 * MIN)
    expect(next.mode).toBe(MODES.LONG_BREAK)
    expect(next.remainingMs).toBe(15 * MIN)
  })

  it('moves a long break back into round 1 of work', () => {
    const now = at(12)
    const running = start({ ...IDLE_STATE, mode: MODES.LONG_BREAK, round: 4 }, DEFAULT_SETTINGS, now)
    const next = advance(running, DEFAULT_SETTINGS, now + 15 * MIN)
    expect(next).toEqual({ mode: MODES.WORK, round: 1, status: 'running', remainingMs: 25 * MIN, runningSince: now + 15 * MIN })
  })

  it('never cascades past one phase per call, even hours overdue', () => {
    const now = at(12)
    const running = start(IDLE_STATE, DEFAULT_SETTINGS, now)
    const wayLate = now + 4 * 60 * MIN
    const next = advance(running, DEFAULT_SETTINGS, wayLate)
    expect(next.mode).toBe(MODES.SHORT_BREAK)
    expect(next.remainingMs).toBe(5 * MIN) // fresh short break, not negative/cascaded
  })
})
