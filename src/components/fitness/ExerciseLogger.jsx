import { useState } from 'react'
import { Info, Plus, X } from 'lucide-react'
import { useStore } from '../../lib/store'
import { setsOn, lastPerformance, nextTarget, formatWeight } from '../../lib/workout'

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const range = (e) => (e.low === e.high ? `${e.low}` : `${e.low}–${e.high}`)

const targetLine = (target) => {
  if (target.advance === 'start') return `Start at ${target.reps} reps and find the weight`
  const verb = target.advance === 'weight' ? 'Add weight' : 'Add a rep'
  return `${verb}: ${formatWeight(target.weight)} × ${target.reps}`
}

/**
 * One exercise, logged in place. The inputs come pre-filled with what double
 * progression says to do next (or with the set you just logged, so a repeat
 * set is a single tap) — the whole point is that at the rack you press one
 * button and only touch the numbers when reality disagrees.
 */
export default function ExerciseLogger({ exercise, logs, date }) {
  const logSet = useStore((s) => s.logSet)
  const deleteSet = useStore((s) => s.deleteSet)
  const [showCue, setShowCue] = useState(false)

  const today = setsOn(logs, exercise.id, date)
  const last = lastPerformance(logs, exercise.id, date)
  const target = nextTarget(exercise, last)

  // Draft follows the last set logged today, then the target, then blank.
  const previous = today[today.length - 1]
  const suggestedWeight = previous?.weight ?? target.weight
  const suggestedReps = previous?.reps ?? target.reps
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const weightValue = weight === '' ? suggestedWeight : Number(weight)
  const repsValue = reps === '' ? suggestedReps : Number(reps)
  const canLog = Number.isFinite(repsValue) && repsValue > 0 && (exercise.bodyweight || weightValue != null)

  const commit = () => {
    if (!canLog) return
    logSet(exercise.id, weightValue ?? 0, repsValue, date)
    setWeight('')
    setReps('')
  }

  const done = today.length >= exercise.sets

  return (
    <div className={`wo-ex ${done ? 'done' : ''}`}>
      <div className="wo-ex-head">
        <span className="fin-grow">{exercise.name}</span>
        <span className="fin-sub fin-amount">
          {today.length}/{exercise.sets} × {range(exercise)}{exercise.perSide ? '/side' : ''}
        </span>
        <button
          className="wo-info" onClick={() => setShowCue(!showCue)}
          aria-label={`Form cue for ${exercise.name}`} aria-expanded={showCue}
        >
          <Info size={15} strokeWidth={1.75} />
        </button>
      </div>

      {showCue && (
        <p className="wo-cue">
          {exercise.cue}
          {exercise.alt && <> <em>No machine? {exercise.alt}.</em></>}
        </p>
      )}

      <div className="wo-target">
        {targetLine(target)}
        {last && (
          <span className="wo-last">
            {' · '}last {shortDate(last.date)}: {last.sets.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join(', ')}
          </span>
        )}
      </div>

      <div className="wo-entry">
        <input
          type="number" inputMode="decimal" step="2.5" min="0"
          className="wo-num" aria-label={`${exercise.name} weight`}
          placeholder={suggestedWeight == null ? 'lb' : String(suggestedWeight)}
          value={weight} onChange={(e) => setWeight(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <span className="wo-x">×</span>
        <input
          type="number" inputMode="numeric" min="1"
          className="wo-num" aria-label={`${exercise.name} reps`}
          placeholder={String(suggestedReps)}
          value={reps} onChange={(e) => setReps(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button className="wo-log" onClick={commit} disabled={!canLog}>
          <Plus size={15} strokeWidth={2.25} />Log set
        </button>
      </div>

      {today.length > 0 && (
        <div className="wo-sets">
          {today.map((s, i) => (
            <button
              key={s.id} className="wo-set" onClick={() => deleteSet(s.id)}
              aria-label={`Remove set ${i + 1}, ${formatWeight(s.weight)} for ${s.reps} reps`}
            >
              {formatWeight(s.weight)} × {s.reps}
              <X size={11} strokeWidth={2.25} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
