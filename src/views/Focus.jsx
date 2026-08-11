import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/rewards'
import { notifyPermission, requestNotifyPermission, fireNotification } from '../lib/notify'
import {
  MODES, phaseDurationMs, remainingMs as computeRemainingMs,
  start as startPhase, pause as pausePhase, reset as resetPhase,
} from '../lib/focusTimer'
import { createFocusRunner, TICK_MS, readSettings, writeSettings, readState, writeState } from '../lib/focusRunner'
import AreaIcon from '../components/AreaIcon'

const WORK_PRESETS = [15, 25, 50]
const BREAK_PRESETS = [5, 10, 15]
const MODE_LABEL = { [MODES.WORK]: 'Work', [MODES.SHORT_BREAK]: 'Short break', [MODES.LONG_BREAK]: 'Long break' }

const fmt = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Focus() {
  const logs = useStore((s) => s.logs)
  const logFocusSession = useStore((s) => s.logFocusSession)

  const [settings, setSettings] = useState(readSettings)
  const [state, setState] = useState(readState)
  const [clock, setClock] = useState(() => Date.now())

  const settingsRef = useRef(settings)
  const stateRef = useRef(state)
  settingsRef.current = settings
  stateRef.current = state

  const applyState = (next) => {
    stateRef.current = next
    setState(next)
    writeState(next)
  }

  // Ticks once a second: re-renders the countdown and, via the runner,
  // advances/logs/notifies exactly when a phase completes. Runs an
  // immediate tick on mount too, so reopening the page after the phase
  // already elapsed (tab closed, app backgrounded) catches up right away
  // instead of waiting for the next second.
  useEffect(() => {
    const runner = createFocusRunner({
      getState: () => stateRef.current,
      setState: applyState,
      getSettings: () => settingsRef.current,
      now: () => Date.now(),
      onWorkComplete: () => logFocusSession(todayKey()),
      fire: (body) => fireNotification(body, 'focus'),
    })
    runner.tick()
    const id = setInterval(() => {
      runner.tick()
      setClock(Date.now())
    }, TICK_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onStart = async () => {
    if (notifyPermission() === 'default') {
      // Best-effort -- unlike Nudges, the timer itself is useful with or
      // without notifications, so a dismissed/denied prompt doesn't block
      // starting it.
      await requestNotifyPermission()
    }
    applyState(startPhase(stateRef.current, settingsRef.current, Date.now()))
  }

  const onPause = () => applyState(pausePhase(stateRef.current, Date.now()))

  const onReset = () => applyState(resetPhase(settingsRef.current))

  const saveSettings = (next) => {
    setSettings(next)
    settingsRef.current = next
    writeSettings(next)
    // Only the fully-idle countdown reflects a preset change immediately --
    // a paused or running phase keeps its current time, the new duration
    // applies starting next phase.
    if (stateRef.current.status === 'idle') applyState(resetPhase(next))
  }

  const setWorkMin = (workMin) => saveSettings({ ...settings, workMin })
  const setBreakMin = (shortBreakMin) => saveSettings({ ...settings, shortBreakMin })

  const remaining = computeRemainingMs(state, clock)
  const duration = phaseDurationMs(state.mode, settings)
  const fillPct = duration > 0 ? Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100)) : 0
  const completedRounds = state.mode === MODES.WORK ? state.round - 1 : state.round
  const sessionsToday = logs.filter(
    (l) => !l.deletedAt && l.areaId === 'focus' && l.kind === 'complete' && l.date === todayKey(),
  ).length
  const pillsDisabled = state.status === 'running'

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-v)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="Timer" /></div>
        <h1>Focus</h1>
      </div>

      <div className="focus-body">
        <div className="focus-mode">{MODE_LABEL[state.mode]} · round {state.round} of {settings.roundsBeforeLongBreak}</div>
        <div className="focus-time">{fmt(remaining)}</div>
        <div className="focus-bar-track"><div className="focus-bar-fill" style={{ width: `${fillPct}%` }} /></div>
        <div className="focus-dots">
          {Array.from({ length: settings.roundsBeforeLongBreak }, (_, i) => (
            <div key={i} className={`focus-dot ${i < completedRounds ? 'done' : ''}`} />
          ))}
        </div>
        <div className="focus-controls">
          {state.status === 'running' ? (
            <button className="focus-btn primary" onClick={onPause}>Pause</button>
          ) : (
            <button className="focus-btn primary" onClick={onStart}>{state.status === 'paused' ? 'Resume' : 'Start'}</button>
          )}
          <button className="focus-btn" onClick={onReset}>Reset</button>
        </div>
        <div className="focus-today">{sessionsToday} session{sessionsToday === 1 ? '' : 's'} today</div>
      </div>

      <div className="section-label">Work length</div>
      <div className="bucket-tabs">
        {WORK_PRESETS.map((m) => (
          <button
            key={m}
            className={`bucket-tab ${settings.workMin === m ? 'on' : ''}`}
            disabled={pillsDisabled}
            onClick={() => setWorkMin(m)}
          >
            {m}m
          </button>
        ))}
      </div>
      <div className="section-label">Break length</div>
      <div className="bucket-tabs">
        {BREAK_PRESETS.map((m) => (
          <button
            key={m}
            className={`bucket-tab ${settings.shortBreakMin === m ? 'on' : ''}`}
            disabled={pillsDisabled}
            onClick={() => setBreakMin(m)}
          >
            {m}m
          </button>
        ))}
      </div>
    </div>
  )
}
