import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems, selectWorkoutSessions } from '../lib/store'
import { areaById } from '../data/areas'
import { todayKey, startOfWeekKey } from '../lib/rewards'
import { sessionDates, sessionSummary, sessionCountSince, buildExerciseIndex } from '../lib/workout'
import { SESSION_BUCKET } from '../data/workoutProgram'
import AreaIcon from '../components/AreaIcon'
import ItemList from '../components/ItemList'
import SessionLogger from '../components/fitness/SessionLogger'
import ProgressChart from '../components/fitness/ProgressChart'
import ProgramCard from '../components/fitness/ProgramCard'

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * The fitness area's dedicated page — the same mechanism as Finance and
 * Projects (`route` in areas.js), for the same reason: a set of weight x reps
 * is not something a flat item row can express.
 *
 * The program itself is ITEMs (session parents, exercise sub-items), so every
 * part of it is editable here. "Tracking" is the ordinary generic item list
 * this area has always had — Top Priorities still check off daily and still
 * feed the daily-practice chart, untouched. The two never mix: program items
 * live in the SESSION_BUCKET or hang off a session by parentId, and the
 * tracking tabs only ever show the area's own buckets.
 */
export default function Fitness() {
  const area = areaById('fitness')
  const date = todayKey()
  const weekday = new Date().getDay()

  const items = useStore(useShallow(selectAreaItems('fitness')))
  const sessions = useStore(useShallow(selectWorkoutSessions))
  const allItems = useStore((s) => s.items)
  const logs = useStore((s) => s.logs)
  const addItem = useStore((s) => s.addItem)

  const exerciseIndex = useMemo(() => buildExerciseIndex(allItems), [allItems])

  const [bucket, setBucket] = useState(area.habitBucket)
  const [draft, setDraft] = useState('')

  const thisWeek = sessionCountSince(logs, startOfWeekKey())
  const history = useMemo(
    () => sessionDates(logs).slice(0, 6).map((d) => sessionSummary(logs, exerciseIndex, d)),
    [logs, exerciseIndex],
  )
  const sessionTitle = useCallback(
    (id) => sessions.find((s) => s.id === id)?.title ?? 'Ad hoc',
    [sessions],
  )
  const exercisesFor = useCallback(
    (sessionId) =>
      [...exerciseIndex.values()]
        .filter((e) => e.parentId === sessionId && e.status !== 'archived')
        .sort((a, b) => a.order - b.order),
    [exerciseIndex],
  )

  // Tracking shows only the area's own buckets. A session item lives in
  // SESSION_BUCKET and an exercise hangs off one by parentId, so neither can
  // surface here even if a bucket were renamed to collide.
  const shown = items.filter(
    (i) => i.bucket === bucket && i.bucket !== SESSION_BUCKET && !i.parentId,
  )

  const add = () => {
    if (!draft.trim()) return
    addItem('fitness', draft, { bucket })
    setDraft('')
  }

  return (
    <div className="page" style={{ '--area-c1': `var(--trim-${area.trim})` }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name={area.icon} /></div>
        <h1>{area.name}</h1>
        {sessions.length > 0 && (
          <span className="fin-sub">{thisWeek} of {sessions.length} this week</span>
        )}
      </div>

      <SessionLogger
        sessions={sessions} logs={logs} exerciseIndex={exerciseIndex}
        date={date} weekday={weekday}
      />

      <div className="fin-grid">
        <div className="fin-col">
          <ProgressChart logs={logs} exerciseIndex={exerciseIndex} />

          <section className="fin-section card">
            <h3>Recent sessions</h3>
            {history.length === 0 ? (
              <div className="empty-note">No sessions logged yet.</div>
            ) : (
              history.map((h) => (
                <div key={h.date} className="fin-row">
                  <span className="fin-grow">
                    {shortDate(h.date)}
                    <span className="fin-sub"> · {sessionTitle(h.sessionId)}</span>
                  </span>
                  <span className="fin-amount fin-sub">
                    {h.setCount} sets · {h.volume.toLocaleString()} lb
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="fin-col">
          <ProgramCard sessions={sessions} exercisesFor={exercisesFor} />

          <section className="fin-section card">
            <h3>Tracking</h3>
            <div className="bucket-tabs">
              {area.buckets.map((b) => (
                <button
                  key={b} className={`bucket-tab ${bucket === b ? 'on' : ''}`}
                  onClick={() => setBucket(b)}
                >
                  {b}
                </button>
              ))}
            </div>
            <ItemList items={shown} areaId="fitness" habitBucket={area.habitBucket} />
            <div className="fin-addrow">
              <input
                className="fin-title" placeholder={`Add to ${bucket}…`}
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <button className="fin-add" onClick={add} aria-label="Add">
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
