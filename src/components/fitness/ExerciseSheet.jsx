import { useState } from 'react'
import { ArrowDown, ArrowUp, Dumbbell } from 'lucide-react'
import { useStore } from '../../lib/store'
import { exerciseSpec } from '../../data/workoutProgram'

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Edit one exercise: swap the movement, retune the rep range, change the
 * weight jump, reorder it, or drop it. This is the whole point of the
 * program being ITEMs — the gym not having a machine is a 20-second edit,
 * not a code change.
 *
 * Archive and delete are deliberately different doors, and the copy says so:
 * archiving takes the exercise out of the rotation but keeps every set you
 * ever logged on it, while deleting takes the history with it (deleteItem
 * tombstones an item's logs — the house rule, not a special case here).
 */
export default function ExerciseSheet({ exercise, siblings, onClose }) {
  const updateItem = useStore((s) => s.updateItem)
  const archiveItem = useStore((s) => s.archiveItem)
  const restoreItem = useStore((s) => s.restoreItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const reorderSubItems = useStore((s) => s.reorderSubItems)

  const spec = exerciseSpec(exercise)
  const [title, setTitle] = useState(exercise.title)
  const [details, setDetails] = useState(exercise.details ?? '')
  const [sets, setSets] = useState(String(spec.sets))
  const [low, setLow] = useState(String(spec.low))
  const [high, setHigh] = useState(String(spec.high))
  const [step, setStep] = useState(String(Math.abs(spec.step)))
  const [assisted, setAssisted] = useState(spec.step < 0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const archived = exercise.status === 'archived'
  const index = siblings.findIndex((s) => s.id === exercise.id)

  const move = (delta) => {
    const ids = siblings.map((s) => s.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ids.splice(target, 0, ...ids.splice(index, 1))
    reorderSubItems(exercise.parentId, ids)
    onClose()
  }

  const save = () => {
    // A range typed backwards (12 low, 8 high) is a slip, not an intent —
    // ordering them keeps every progression check downstream meaningful.
    const lowN = Math.max(1, int(low, spec.low))
    const highN = Math.max(1, int(high, spec.high))
    const magnitude = Math.max(0, int(step, Math.abs(spec.step)))
    updateItem(exercise.id, {
      title: title.trim() || exercise.title,
      details,
      sets: Math.max(1, int(sets, spec.sets)),
      low: Math.min(lowN, highN),
      high: Math.max(lowN, highN),
      step: assisted ? -magnitude : magnitude,
    })
    onClose()
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Edit exercise">
        <div className="sheet-grab" />
        <h2><Dumbbell size={16} /> Edit exercise</h2>

        <div className="field">
          <label>Exercise</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="wo-spec-grid">
          <div className="field">
            <label>Sets</label>
            <input type="number" inputMode="numeric" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
          </div>
          <div className="field">
            <label>Reps from</label>
            <input type="number" inputMode="numeric" min="1" value={low} onChange={(e) => setLow(e.target.value)} />
          </div>
          <div className="field">
            <label>Reps to</label>
            <input type="number" inputMode="numeric" min="1" value={high} onChange={(e) => setHigh(e.target.value)} />
          </div>
          <div className="field">
            <label>Weight jump</label>
            <input type="number" inputMode="decimal" min="0" value={step} onChange={(e) => setStep(e.target.value)} />
          </div>
        </div>
        <p className="wo-hint">
          When you hit {high || spec.high} reps on every set, the target
          {assisted ? ' drops ' : ' adds '}{step || Math.abs(spec.step)} lb and the reps go back to {low || spec.low}.
        </p>

        <div className="field">
          <label>Machine type</label>
          <div className="link-chips">
            <button className={`chip ${!assisted ? 'on' : ''}`} onClick={() => setAssisted(false)}>
              Normal — more weight is progress
            </button>
            <button className={`chip ${assisted ? 'on' : ''}`} onClick={() => setAssisted(true)}>
              Assistance — less weight is progress
            </button>
          </div>
        </div>

        <div className="field">
          <label>Form notes</label>
          <textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="The cue that makes or breaks this movement…" />
        </div>

        {siblings.length > 1 && (
          <div className="field">
            <label>Order in the session ({index + 1} of {siblings.length})</label>
            <div className="link-chips">
              <button className="chip" onClick={() => move(-1)} disabled={index <= 0}>
                <ArrowUp size={13} /> Move up
              </button>
              <button className="chip" onClick={() => move(1)} disabled={index >= siblings.length - 1}>
                <ArrowDown size={13} /> Move down
              </button>
            </div>
          </div>
        )}

        <div className="sheet-actions">
          <button className="btn-primary" onClick={save}>Save</button>
          {archived ? (
            <button className="btn-ghost" onClick={() => { restoreItem(exercise.id); onClose() }}>Restore</button>
          ) : (
            <button className="btn-ghost" onClick={() => { archiveItem(exercise.id); onClose() }}>Retire</button>
          )}
          <button
            className="btn-ghost btn-danger"
            onClick={() => {
              if (confirmDelete) { deleteItem(exercise.id); onClose() }
              else setConfirmDelete(true)
            }}
          >
            {confirmDelete ? 'Delete history too?' : 'Delete'}
          </button>
        </div>
        <p className="wo-hint">
          Retire takes it out of the session but keeps every set you logged on it.
          Delete removes those sets as well.
        </p>
      </div>
    </>
  )
}
