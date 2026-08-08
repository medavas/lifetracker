import { useState } from 'react'
import { SESSIONS, sessionForWeekday } from '../../data/workoutProgram'
import { sessionSummary } from '../../lib/workout'
import ExerciseLogger from './ExerciseLogger'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Groups a session's exercises into runs of consecutive supersetted moves,
 * so the pair that is meant to be run back to back renders as one block
 * instead of two unrelated rows. Everything else comes through as a run of
 * one, which is why the caller can render both cases identically.
 */
function groupExercises(exercises) {
  const groups = []
  for (const e of exercises) {
    const prev = groups[groups.length - 1]
    if (e.superset && prev?.superset === e.superset) prev.items.push(e)
    else groups.push({ superset: e.superset, items: [e] })
  }
  return groups
}

/**
 * Today's session: which day it is, what's on it, and the logging surface.
 * The scheduled session is pre-selected from the weekday, but every session
 * stays one tap away — a week that forces Monday still needs to log Wednesday's
 * work, and the program says a moved session beats a skipped one.
 */
export default function SessionLogger({ logs, date, weekday }) {
  const scheduled = sessionForWeekday(weekday)
  const [pickedId, setPickedId] = useState(scheduled?.id ?? null)
  const session = SESSIONS.find((s) => s.id === pickedId) ?? scheduled ?? SESSIONS[0]

  const summary = sessionSummary(logs, date)

  return (
    <section className="fin-section card">
      <div className="wo-head">
        <div className="fin-grow">
          <div className="fin-headline"><strong>{session.name}</strong></div>
          <div className="fin-sub">
            {scheduled
              ? `Scheduled for ${DAY_SHORT[weekday]}`
              : `${DAY_SHORT[weekday]} is a rest day — logging anyway`}
            {summary.setCount > 0 && ` · ${summary.setCount} sets · ${summary.volume.toLocaleString()} lb moved`}
          </div>
        </div>
      </div>

      <div className="bucket-tabs wo-tabs">
        {SESSIONS.map((s) => (
          <button
            key={s.id}
            className={`bucket-tab ${s.id === session.id ? 'on' : ''}`}
            onClick={() => setPickedId(s.id)}
          >
            {DAY_SHORT[s.weekday]} · {s.name}
          </button>
        ))}
      </div>

      <div className="wo-list">
        {groupExercises(session.exercises).map((group) => (
          <div key={group.items[0].id} className={group.superset ? 'wo-superset' : undefined}>
            {group.superset && <div className="wo-superset-label">Superset — alternate these</div>}
            {group.items.map((e) => (
              <ExerciseLogger key={e.id} exercise={e} logs={logs} date={date} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
