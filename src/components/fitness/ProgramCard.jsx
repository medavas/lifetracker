import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { RULES, SCHEDULE_NOTE, SESSIONS } from '../../data/workoutProgram'

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const range = (e) => (e.low === e.high ? `${e.low}` : `${e.low}–${e.high}`)

/**
 * The program itself, as a reference you can re-read at the rack: the rules
 * first (they are what actually drives progress), then all three day
 * templates. Collapsed by default — you read this once and then live in the
 * logger above it.
 */
export default function ProgramCard() {
  const [open, setOpen] = useState(false)

  return (
    <section className="fin-section card">
      <button className="wo-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>The program</h3>
        <span className="fin-sub">{open ? 'Hide' : 'Rules and all three days'}</span>
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

          {SESSIONS.map((s) => (
            <div key={s.id} className="wo-day">
              <h4>{DAY[s.weekday]} — {s.name}</h4>
              {s.exercises.map((e) => (
                <div key={e.id} className="wo-day-row">
                  <span className="fin-grow">
                    {e.name}
                    {e.alt && <span className="wo-alt"> (or {e.alt.toLowerCase()})</span>}
                  </span>
                  <span className="fin-amount fin-sub">
                    {e.sets} × {range(e)}{e.perSide ? '/side' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
