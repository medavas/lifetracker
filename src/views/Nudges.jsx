import { useEffect, useState } from 'react'
import { Moon, Plus, Trash2, Quote as QuoteIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems, selectPhilosophyNudgeItems } from '../lib/store'
import { nextFireAt, nextDailyFireAt, nextPhilosophyFireAt } from '../lib/timers'
import { notifyPermission, requestNotifyPermission } from '../lib/notify'
import {
  readLastFired, seedAnchor, clearAnchor, readQuiet, writeQuiet,
  readPhilosophyOn, writePhilosophyOn, readPhilosophyRotation, writePhilosophyRotation,
} from '../lib/nudgeRunner'
import AreaIcon from '../components/AreaIcon'

const PRESETS = [15, 30, 45, 60, 120]

const everyLabel = (mins) => (mins < 60 ? `${mins}m` : `${mins / 60}h`)

const hhmm = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

// Returns null on an incomplete/cleared time input rather than NaN, so a
// caller can ignore the change instead of persisting a corrupt quiet window.
const toMins = (value) => {
  const [h, m] = value.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

/** "in 42m" / "in 1h 12m" / "any moment now" */
const countdown = (at, now) => {
  if (at == null) return null
  const left = Math.max(0, at - now)
  const mins = Math.round(left / 60_000)
  if (mins <= 0) return 'any moment now'
  if (mins < 60) return `in ${mins}m`
  return `in ${Math.floor(mins / 60)}h ${mins % 60}m`
}

const nudgeMeta = (n, due, blocked) => {
  const when = n.timeMin != null ? `at ${hhmm(n.timeMin)}` : `every ${everyLabel(n.intervalMin)}`
  const dueText = n.enabled && due ? ` · ${due}` : ''
  const blockedText = n.enabled && blocked ? ' · blocked' : ''
  return `${when}${dueText}${blockedText}`
}

/** One row shared by the interval and daily-reminder lists -- module scope so it isn't re-created (and every row remounted) on each Nudges render. */
const NudgeRow = ({ n, due, blocked, onToggle, onDelete }) => (
  <div className={`nudge-row ${n.enabled ? 'on' : ''}`}>
    <button
      className={`switch ${n.enabled ? 'on' : ''}`}
      role="switch"
      aria-checked={n.enabled}
      onClick={() => onToggle(n)}
      aria-label={`${n.enabled ? 'Switch off' : 'Switch on'} ${n.title}`}
    >
      <span />
    </button>
    <div className="nudge-body">
      <div className="item-title">{n.title}</div>
      <div className="nudge-meta">{nudgeMeta(n, due, blocked)}</div>
    </div>
    <button className="detail-btn" onClick={() => onDelete(n.id)} aria-label={`Delete ${n.title}`}>
      <Trash2 size={16} strokeWidth={1.75} />
    </button>
  </div>
)

/** iOS requires the permission prompt to come from a live user gesture -- asking on load is the reliable way to get permanently denied. Shared by every switch that can newly enable a notification. */
const ensureNotifyPermission = async (setPermission) => {
  let perm = notifyPermission()
  if (perm !== 'default') return perm
  perm = await requestNotifyPermission()
  setPermission(perm)
  return perm
}

/**
 * Nudges: always-on timers, each firing its own message while Stoa is open.
 * Nothing is logged — these are ambient prompts, not tracked habits. A nudge
 * either repeats every N minutes or fires once at a fixed clock time each
 * day; the Philosophy rotation below reuses the same repeat mechanism to
 * play through your quotes/principles, spaced across your waking hours.
 */
export default function Nudges() {
  const nudges = useStore(useShallow(selectAreaItems('nudges')))
  const philosophyItems = useStore(useShallow(selectPhilosophyNudgeItems))
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)

  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState('interval')
  const [intervalMin, setIntervalMin] = useState(45)
  const [timeDraft, setTimeDraft] = useState('07:00')
  const [permission, setPermission] = useState(notifyPermission())
  const [quiet, setQuiet] = useState(readQuiet)
  const [philOn, setPhilOn] = useState(readPhilosophyOn)
  const [now, setNow] = useState(() => Date.now())

  // Re-render once a minute so the countdowns stay honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const saveQuiet = (next) => {
    setQuiet(next)
    writeQuiet(next)
  }

  const add = () => {
    if (!draft.trim()) return
    if (mode === 'daily') {
      const timeMin = toMins(timeDraft)
      if (timeMin == null) return
      addItem('nudges', draft, { type: 'timer', timeMin, enabled: false })
    } else {
      addItem('nudges', draft, { type: 'timer', intervalMin, enabled: false })
    }
    setDraft('')
  }

  const toggle = async (n) => {
    if (n.enabled) {
      clearAnchor(n.id)
      updateItem(n.id, { enabled: false })
      return
    }
    // Only a permission that was 'default' just now can block enabling: a
    // dismissed prompt or a fresh 'denied' leaves the nudge OFF rather than
    // switching on with no way to ever fire silently. An ALREADY-denied or
    // unsupported permission is let through on purpose -- nudges must stay
    // creatable and toggleable even when notifications are blocked, so they
    // can be configured ahead of time; the banner above already makes clear
    // that nothing will fire until permission is granted.
    const wasDefault = notifyPermission() === 'default'
    const perm = await ensureNotifyPermission(setPermission)
    if (wasDefault && perm !== 'granted') return
    seedAnchor(n.id)
    updateItem(n.id, { enabled: true })
  }

  const togglePhilosophy = async () => {
    if (philOn) {
      writePhilosophyOn(false)
      setPhilOn(false)
      return
    }
    const wasDefault = notifyPermission() === 'default'
    const perm = await ensureNotifyPermission(setPermission)
    if (wasDefault && perm !== 'granted') return
    // Restart the anchor from now, like seedAnchor above, so re-enabling
    // (possibly hours after being switched off) doesn't fire the instant
    // it's back on -- but keep today's shuffled order/pointer if it's still
    // valid, so an off/on toggle doesn't cost you your place in the rotation.
    writePhilosophyRotation({ ...readPhilosophyRotation(), anchor: Date.now() })
    writePhilosophyOn(true)
    setPhilOn(true)
  }

  const lastFired = readLastFired()
  const philRotation = readPhilosophyRotation()
  const philDue = philOn ? countdown(nextPhilosophyFireAt(philRotation, quiet), now) : null
  const intervalNudges = nudges.filter((n) => n.intervalMin != null)
  const dailyNudges = nudges.filter((n) => n.timeMin != null)

  const removeNudge = (id) => { clearAnchor(id); deleteItem(id) }

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-o)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="BellRing" /></div>
        <h1>Nudges</h1>
      </div>

      {permission !== 'granted' && (
        <div className={`nudge-banner ${permission === 'default' ? '' : 'bad'}`}>
          {permission === 'unsupported' && 'This browser cannot show notifications. On iPhone, add Stoa to your home screen first.'}
          {permission === 'denied' && 'Notifications are blocked. Re-enable them for this site in your browser settings — nudges will not fire until you do.'}
          {permission === 'default' && 'Switching a nudge on will ask your browser for permission. Dismiss that prompt and the nudge stays off.'}
        </div>
      )}

      <div className="card nudge-new">
        <input
          value={draft}
          placeholder="Message to nudge yourself with…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <div className="bucket-tabs nudge-mode-tabs">
          <button className={`bucket-tab ${mode === 'interval' ? 'on' : ''}`} onClick={() => setMode('interval')}>
            Repeats
          </button>
          <button className={`bucket-tab ${mode === 'daily' ? 'on' : ''}`} onClick={() => setMode('daily')}>
            At a time daily
          </button>
        </div>
        {mode === 'interval' ? (
          <div className="nudge-new-foot">
            <span className="nudge-every">Every</span>
            <div className="bucket-tabs">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  className={`bucket-tab ${intervalMin === m ? 'on' : ''}`}
                  onClick={() => setIntervalMin(m)}
                >
                  {everyLabel(m)}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={add} disabled={!draft.trim()}>
              <Plus size={16} strokeWidth={2} />Add
            </button>
          </div>
        ) : (
          <div className="nudge-new-foot">
            <span className="nudge-every">At</span>
            <input
              type="time"
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              aria-label="Reminder time"
            />
            <button className="btn-primary" onClick={add} disabled={!draft.trim() || toMins(timeDraft) == null}>
              <Plus size={16} strokeWidth={2} />Add
            </button>
          </div>
        )}
      </div>

      {nudges.length === 0 ? (
        <div className="empty-note">
          A nudge is a message on a repeat, or one that fires at a set time every day.
          <br />Water every 2h, a bedtime wind-down at 22:30. Nothing is logged.
        </div>
      ) : (
        <>
          {intervalNudges.length > 0 && (
            <>
              <div className="section-label">Your nudges</div>
              <div className="item-list">
                {intervalNudges.map((n) => (
                  <NudgeRow
                    key={n.id}
                    n={n}
                    due={countdown(nextFireAt(n, lastFired), now)}
                    blocked={permission !== 'granted'}
                    onToggle={toggle}
                    onDelete={removeNudge}
                  />
                ))}
              </div>
            </>
          )}

          {dailyNudges.length > 0 && (
            <>
              <div className="section-label">Daily reminders</div>
              <div className="item-list">
                {dailyNudges.map((n) => (
                  <NudgeRow
                    key={n.id}
                    n={n}
                    due={countdown(nextDailyFireAt(n, lastFired, now), now)}
                    blocked={permission !== 'granted'}
                    onToggle={toggle}
                    onDelete={removeNudge}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="section-label">Philosophy rotation</div>
      <div className="card quiet-block">
        <div className="quiet-head">
          <QuoteIcon size={15} strokeWidth={1.75} />
          <span>Nudge me with quotes &amp; principles</span>
          <button
            className={`switch ${philOn ? 'on' : ''}`}
            role="switch"
            aria-checked={philOn}
            aria-label="Philosophy rotation"
            onClick={togglePhilosophy}
          >
            <span />
          </button>
        </div>
        <p className="hint">
          Plays through the items switched on below, one at a time, evenly spaced across your
          waking hours (outside Quiet hours below) in a random order that reshuffles every day.
          {philOn && philDue ? ` Next one ${philDue}.` : ''}
          {philOn && permission !== 'granted' ? ' Blocked until notifications are allowed.' : ''}
        </p>
        {philosophyItems.length === 0 ? (
          <p className="hint">No Quotes or Principles yet — add some in Philosophy first.</p>
        ) : (
          <div className="item-list">
            {philosophyItems.map((item) => {
              const on = item.nudgeOn !== false
              return (
                <div key={item.id} className="nudge-row">
                  <button
                    className={`switch ${on ? 'on' : ''}`}
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? 'Exclude' : 'Include'} "${item.title}" from the rotation`}
                    onClick={() => updateItem(item.id, { nudgeOn: !on })}
                  >
                    <span />
                  </button>
                  <div className="nudge-body">
                    <div className="item-title">{item.title}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="section-label">Quiet hours</div>
      <div className="card quiet-block">
        <div className="quiet-head">
          <Moon size={15} strokeWidth={1.75} />
          <span>Skip nudges overnight</span>
          <button
            className={`switch ${quiet.on ? 'on' : ''}`}
            role="switch"
            aria-checked={quiet.on}
            aria-label="Quiet hours"
            onClick={() => saveQuiet({ ...quiet, on: !quiet.on })}
          >
            <span />
          </button>
        </div>
        <div className="quiet-times">
          <input
            type="time"
            value={hhmm(quiet.startMin)}
            onChange={(e) => {
              const startMin = toMins(e.target.value)
              // Clearing the field yields null -- ignore it rather than
              // persisting a corrupt quiet window (see nudge-timers finding #3).
              if (startMin != null) saveQuiet({ ...quiet, startMin })
            }}
            aria-label="Quiet hours start"
          />
          <span>to</span>
          <input
            type="time"
            value={hhmm(quiet.endMin)}
            onChange={(e) => {
              const endMin = toMins(e.target.value)
              if (endMin != null) saveQuiet({ ...quiet, endMin })
            }}
            aria-label="Quiet hours end"
          />
        </div>
        <p className="hint">Nudges due in this window are skipped, not stacked up for later.</p>
      </div>
    </div>
  )
}
