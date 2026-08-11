import { useEffect, useState } from 'react'
import { Moon, Plus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { nextFireAt } from '../lib/timers'
import { notifyPermission, requestNotifyPermission } from '../lib/notify'
import { readLastFired, seedAnchor, clearAnchor, readQuiet, writeQuiet } from '../lib/nudgeRunner'
import AreaIcon from '../components/AreaIcon'

const PRESETS = [15, 30, 45, 60, 120]

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

/**
 * Nudges: always-on interval timers. Each fires its own message while Stoa is
 * open. Nothing is logged — these are ambient prompts, not tracked habits.
 */
export default function Nudges() {
  const nudges = useStore(useShallow(selectAreaItems('nudges')))
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)

  const [draft, setDraft] = useState('')
  const [intervalMin, setIntervalMin] = useState(45)
  const [permission, setPermission] = useState(notifyPermission())
  const [quiet, setQuiet] = useState(readQuiet)
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
    addItem('nudges', draft, { type: 'timer', intervalMin, enabled: false })
    setDraft('')
  }

  const toggle = async (n) => {
    if (n.enabled) {
      clearAnchor(n.id)
      updateItem(n.id, { enabled: false })
      return
    }
    let perm = notifyPermission()
    if (perm === 'default') {
      // First ask. Must come from this click -- iOS requires a live user
      // gesture, and asking on load is the reliable way to get permanently
      // denied.
      perm = await requestNotifyPermission()
      setPermission(perm)
      // Dismissed the prompt (still 'default') or just got 'denied': per
      // spec, the nudge stays OFF rather than switching on with no way to
      // ever fire silently. Do not seed the anchor or enable.
      if (perm !== 'granted') return
    }
    // Reaching here means either: permission was just granted above, or it
    // was ALREADY 'granted'/'denied'/'unsupported' before this click (not
    // 'default'). The already-denied/unsupported case is intentionally let
    // through -- nudges must stay creatable and toggleable even when
    // permission is denied, so they can be configured ahead of time; the
    // banners above already make clear that nothing will fire until then.
    seedAnchor(n.id)
    updateItem(n.id, { enabled: true })
  }

  const lastFired = readLastFired()

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-o)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="BellRing" /></div>
        <h1>Nudges</h1>
      </div>

      {permission === 'unsupported' && (
        <div className="status-error">
          This browser cannot show notifications. On iPhone, add Stoa to your home
          screen first.
        </div>
      )}
      {permission === 'denied' && (
        <div className="status-error">
          Notifications are blocked. Re-enable them for this site in your browser
          settings — nudges will not fire until you do.
        </div>
      )}
      {permission === 'default' && (
        <div className="status-error">
          Notifications have not been allowed yet. Switching a nudge on will ask
          your browser for permission — if you dismiss that prompt, the nudge
          stays off.
        </div>
      )}

      {nudges.length === 0 && (
        <div className="empty-note">
          A nudge is a message on a repeat.
          <br />Water every 2h, stand up every 45m. Nothing is logged.
        </div>
      )}

      <div className="item-list">
        {nudges.map((n) => {
          const due = countdown(nextFireAt(n, lastFired), now)
          return (
            <div key={n.id} className="nudge-row">
              <button
                className={`nudge-dot ${n.enabled ? 'on' : ''}`}
                onClick={() => toggle(n)}
                aria-label={`${n.enabled ? 'Switch off' : 'Switch on'} ${n.title}`}
                aria-pressed={n.enabled}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">{n.title}</div>
                <div className="nudge-meta">
                  every {n.intervalMin}m{n.enabled && due ? ` · ${due}` : ''}
                  {n.enabled && permission !== 'granted' ? ' (blocked)' : ''}
                </div>
              </div>
              <button
                className="detail-btn"
                onClick={() => { clearAnchor(n.id); deleteItem(n.id) }}
                aria-label={`Delete ${n.title}`}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="add-row">
        <input
          value={draft}
          placeholder="Message to nudge yourself with…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>

      <div className="bucket-tabs">
        {PRESETS.map((m) => (
          <button
            key={m}
            className={`bucket-tab ${intervalMin === m ? 'on' : ''}`}
            onClick={() => setIntervalMin(m)}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="quiet-block">
        <label className="quiet-head">
          <Moon size={15} strokeWidth={1.75} />
          <span>Quiet hours</span>
          <input
            type="checkbox"
            checked={quiet.on}
            onChange={(e) => saveQuiet({ ...quiet, on: e.target.checked })}
          />
        </label>
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
