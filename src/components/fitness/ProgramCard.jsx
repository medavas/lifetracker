import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { RULES, SCHEDULE_NOTE, WEEKDAY_LONG } from '../../data/workoutProgram'
import { formatTarget } from '../../lib/workout'

/**
 * The rules, then the plan as it currently stands.
 *
 * The rules are fixed — they are the method, and no gym's machine selection
 * changes what "1-2 reps shy of failure" means. The day list underneath is
 * read from the live program items, so it always reflects the edits rather
 * than the plan as first written.
 *
 * Collapsed by default: you read this once and then live in the logger.
 */
export default function ProgramCard({ sessions, exercisesFor }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="fin-section card">
      <button className="wo-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>The program</h3>
        <span className="fin-sub">{open ? 'Hide' : 'Rules and every day'}</span>
      </button>

      {open && (
        <div className="wo-program">
          <ol className="wo-rules">
            {RULES.map((r) => (
              <li key={r.title}>
                <b>{r.title}.</b> {r.text}
              </li>
            ))}
          </ol>
          <p className="wo-note">{SCHEDULE_NOTE}</p>

          {sessions.map((s) => (
            <div key={s.id} className="wo-day">
              <h4>{s.weekday == null ? 'Unscheduled' : WEEKDAY_LONG[s.weekday]} — {s.title}</h4>
              {exercisesFor(s.id).map((e) => (
                <div key={e.id} className="wo-day-row">
                  <span className="fin-grow">{e.title}</span>
                  <span className="fin-amount fin-sub">{formatTarget(e)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
