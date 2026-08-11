import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useStore } from '../../lib/store'
import { useBackDismiss } from '../../lib/useBackDismiss'
import { WEEKDAYS } from '../../data/workoutProgram'

/**
 * Edit a training day: what it is called and which weekday it lands on.
 * The weekday is a plain scalar on the session item, so moving leg day from
 * Sunday to Tuesday is one tap and nothing downstream needs to know.
 *
 * Unscheduled is a real, supported state — a session you keep in the plan
 * but run whenever the week allows.
 */
export default function SessionSheet({ session, onClose }) {
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const [title, setTitle] = useState(session.title)
  const [weekday, setWeekday] = useState(session.weekday ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    updateItem(session.id, { title: title.trim() || session.title, weekday })
    onClose()
  }

  useBackDismiss(save)

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Edit training day">
        <div className="sheet-grab" />
        <h2><CalendarDays size={16} /> Edit training day</h2>

        <div className="field">
          <label>Name</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Day of the week</label>
          <div className="link-chips">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d} className={`chip ${weekday === i ? 'on' : ''}`}
                onClick={() => setWeekday(weekday === i ? null : i)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="wo-hint">
            {weekday == null
              ? 'Unscheduled — it stays in the plan and you run it when the week allows.'
              : `Pre-selected when you open Fitness on a ${WEEKDAYS[weekday]}.`}
          </p>
        </div>

        <div className="sheet-actions">
          <button className="btn-primary" onClick={save}>Save</button>
          <button
            className="btn-ghost btn-danger"
            onClick={() => {
              if (confirmDelete) { deleteItem(session.id); onClose() }
              else setConfirmDelete(true)
            }}
          >
            {confirmDelete ? 'Delete day and its exercises?' : 'Delete day'}
          </button>
        </div>
        <p className="wo-hint">
          Deleting a day removes its exercises and their logged sets with it.
          To pause a day instead, drop its exercises and keep the day empty.
        </p>
      </div>
    </>
  )
}
