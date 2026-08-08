import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectSubItems } from '../../lib/store'
import { WEEKDAYS, SESSION_BUCKET } from '../../data/workoutProgram'
import { sessionSummary } from '../../lib/workout'
import ExerciseLogger from './ExerciseLogger'
import ExerciseSheet from './ExerciseSheet'
import SessionSheet from './SessionSheet'

/**
 * Today's session: which day it is, what's on it, and the logging surface.
 * The session whose `weekday` matches today is pre-selected, but every
 * session stays one tap away — a week that forces Monday still needs to log
 * Wednesday's work, and a moved session beats a skipped one.
 *
 * Everything here is editable because the program is ITEMs: add a day, add
 * an exercise, or open either for editing. Nothing about the plan requires
 * a code change.
 */
export default function SessionLogger({ sessions, logs, exerciseIndex, date, weekday }) {
  const addItem = useStore((s) => s.addItem)
  const seedWorkoutProgram = useStore((s) => s.seedWorkoutProgram)

  const scheduled = sessions.find((s) => s.weekday === weekday)
  const [pickedId, setPickedId] = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [editExercise, setEditExercise] = useState(null)
  const [newDay, setNewDay] = useState(null)
  const [draft, setDraft] = useState('')

  const session = sessions.find((s) => s.id === pickedId) ?? scheduled ?? sessions[0] ?? null
  const exercises = useStore(useShallow(selectSubItems(session?.id ?? '__none__')))
  const summary = sessionSummary(logs, exerciseIndex, date)

  // Following the weekday is the point of the pre-selection, so an explicit
  // pick must not outlive the session it pointed at (deleted day, fresh seed).
  useEffect(() => {
    if (pickedId && !sessions.some((s) => s.id === pickedId)) setPickedId(null)
  }, [pickedId, sessions])

  const addSession = () => {
    if (!newDay?.trim()) return
    const created = addItem('fitness', newDay, { bucket: SESSION_BUCKET })
    setPickedId(created.id)
    setNewDay(null)
  }

  const addExercise = () => {
    if (!draft.trim() || !session) return
    addItem('fitness', draft, { parentId: session.id })
    setDraft('')
  }

  if (sessions.length === 0) {
    return (
      <section className="fin-section card">
        <h3>No program yet</h3>
        <p className="wo-hint">
          Start from the 3-day plan — Saturday upper, Sunday lower, Wednesday full body — and
          edit any of it afterwards. Or build your own day from scratch.
        </p>
        <div className="wo-entry">
          <button className="btn-primary" onClick={seedWorkoutProgram}>Load the 3-day plan</button>
          <button className="btn-ghost" onClick={() => setNewDay('')}>Start empty</button>
        </div>
        {newDay != null && (
          <div className="fin-addrow">
            <input
              className="fin-title" autoFocus placeholder="Name this day, e.g. Push"
              value={newDay} onChange={(e) => setNewDay(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSession()}
            />
            <button className="fin-add" onClick={addSession}>Add</button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="fin-section card">
      <div className="wo-head">
        <div className="fin-grow">
          <div className="fin-headline"><strong>{session.title}</strong></div>
          <div className="fin-sub">
            {session.weekday == null
              ? 'Unscheduled'
              : scheduled?.id === session.id
                ? `Scheduled for ${WEEKDAYS[weekday]}`
                : `Normally ${WEEKDAYS[session.weekday]}`}
            {summary.setCount > 0 && ` · ${summary.setCount} sets · ${summary.volume.toLocaleString()} lb moved`}
          </div>
        </div>
        <button className="wo-info" onClick={() => setEditSession(session)} aria-label="Edit this training day">
          <Pencil size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="bucket-tabs wo-tabs">
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`bucket-tab ${s.id === session.id ? 'on' : ''}`}
            onClick={() => setPickedId(s.id)}
          >
            {s.weekday == null ? s.title : `${WEEKDAYS[s.weekday]} · ${s.title}`}
          </button>
        ))}
        <button className="bucket-tab" onClick={() => setNewDay('')} aria-label="Add a training day">
          <Plus size={14} strokeWidth={2.25} />
        </button>
      </div>

      {newDay != null && (
        <div className="fin-addrow">
          <input
            className="fin-title" autoFocus placeholder="Name this day, e.g. Push"
            value={newDay} onChange={(e) => setNewDay(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSession()}
          />
          <button className="fin-add" onClick={addSession}>Add</button>
          <button className="fin-add" onClick={() => setNewDay(null)}>Cancel</button>
        </div>
      )}

      <div className="wo-list">
        {exercises.length === 0 ? (
          <div className="empty-note">Nothing on this day yet — add the first movement below.</div>
        ) : (
          exercises.map((e) => (
            <ExerciseLogger key={e.id} exercise={e} logs={logs} date={date} onEdit={setEditExercise} />
          ))
        )}
      </div>

      <div className="fin-addrow">
        <input
          className="fin-title" placeholder={`Add an exercise to ${session.title}…`}
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addExercise()}
        />
        <button className="fin-add" onClick={addExercise} aria-label="Add exercise">
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      {editSession && <SessionSheet session={editSession} onClose={() => setEditSession(null)} />}
      {editExercise && (
        <ExerciseSheet
          exercise={editExercise} siblings={exercises} onClose={() => setEditExercise(null)}
        />
      )}
    </section>
  )
}
