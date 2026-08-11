/**
 * Focus (Pomodoro) phase logic -- pure. No DOM, no real clock, no storage:
 * `now` is always an argument, which is what makes every rule below testable
 * without fake timers. Modeled on lib/timers.js.
 *
 * State shape: { mode, round, status, remainingMs, runningSince }
 *   mode          - 'work' | 'short-break' | 'long-break'
 *   round         - which work round of the current cycle (1..roundsBeforeLongBreak)
 *   status        - 'idle' | 'running' | 'paused'
 *   remainingMs   - ms left in the current phase, valid when idle/paused;
 *                   while running it's the snapshot taken at runningSince
 *   runningSince  - epoch ms the current running stretch started, or null
 */

const MS_PER_MIN = 60_000

export const DEFAULT_SETTINGS = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, roundsBeforeLongBreak: 4 }

export const MODES = { WORK: 'work', SHORT_BREAK: 'short-break', LONG_BREAK: 'long-break' }

export const IDLE_STATE = { mode: MODES.WORK, round: 1, status: 'idle', remainingMs: null, runningSince: null }

/** How long a phase lasts, in ms, per the current settings. */
export function phaseDurationMs(mode, settings) {
  const min =
    mode === MODES.WORK ? settings.workMin
    : mode === MODES.SHORT_BREAK ? settings.shortBreakMin
    : settings.longBreakMin
  return min * MS_PER_MIN
}

/**
 * What comes after the given mode/round finishes. A long break always
 * resets the round counter to 1; a short break advances it by one; work
 * goes to a long break on the last round of the cycle, a short break
 * otherwise.
 */
export function nextPhase(mode, round, settings) {
  if (mode === MODES.WORK) {
    return round >= settings.roundsBeforeLongBreak
      ? { mode: MODES.LONG_BREAK, round }
      : { mode: MODES.SHORT_BREAK, round }
  }
  return mode === MODES.LONG_BREAK
    ? { mode: MODES.WORK, round: 1 }
    : { mode: MODES.WORK, round: round + 1 }
}

/** ms left in the current phase right now. Never negative. Idle/paused states report their frozen remainingMs. */
export function remainingMs(state, now) {
  if (state.status !== 'running') return Math.max(0, state.remainingMs ?? 0)
  return Math.max(0, state.remainingMs - (now - state.runningSince))
}

export function isDue(state, now) {
  return state.status === 'running' && remainingMs(state, now) <= 0
}

/**
 * Begin (fresh) or resume (from a pause) counting down. Idle states with no
 * remainingMs get one seeded from settings; a paused state's frozen
 * remainingMs is preserved rather than restarting the phase.
 */
export function start(state, settings, now) {
  const remaining = state.remainingMs ?? phaseDurationMs(state.mode, settings)
  return { ...state, status: 'running', remainingMs: remaining, runningSince: now }
}

/** Freezes the countdown, converting elapsed running time into a stored remainingMs. No-op if not running. */
export function pause(state, now) {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused', remainingMs: remainingMs(state, now), runningSince: null }
}

/** Back to a fresh work phase, round 1, idle. */
export function reset(settings) {
  return { mode: MODES.WORK, round: 1, status: 'idle', remainingMs: phaseDurationMs(MODES.WORK, settings), runningSince: null }
}

/**
 * Moves a due running state to its next phase, still running, anchored to
 * `now`. Always exactly one phase per call -- a state that's hours overdue
 * (app closed mid-phase) jumps straight to the next phase with a fresh
 * countdown rather than cascading through every phase that would have
 * elapsed, the same "fires once, resets anchor to now" rule lib/timers.js
 * applies to overdue nudges.
 */
export function advance(state, settings, now) {
  const { mode, round } = nextPhase(state.mode, state.round, settings)
  return { mode, round, status: 'running', remainingMs: phaseDurationMs(mode, settings), runningSince: now }
}
