import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { areaById } from '../data/areas'
import { todayKey, startOfWeekKey } from '../lib/rewards'
import { sessionDates, sessionSummary, sessionCountSince } from '../lib/workout'
import AreaIcon from '../components/AreaIcon'
import ItemList from '../components/ItemList'
import SessionLogger from '../components/fitness/SessionLogger'
import ProgressChart from '../components/fitness/ProgressChart'
import ProgramCard from '../components/fitness/ProgramCard'
import { SESSIONS } from '../data/workoutProgram'

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * The fitness area's dedicated page — the same mechanism as Finance and
 * Projects (`route` in areas.js), for the same reason: a set of weight x reps
 * is not something a flat item row can express.
 *
 * Everything above "Tracking" reads from LOGs of kind 'set' against the
 * static program in data/workoutProgram.js. "Tracking" is the ordinary
 * generic item list this area has always had — Top Priorities still check
 * off daily and still feed the daily-practice chart, untouched.
 */
export default function Fitness() {
  const area = areaById('fitness')
  const date = todayKey()
  const weekday = new Date().getDay()

  const items = useStore(useShallow(selectAreaItems('fitness')))
  const logs = useStore((s) => s.logs)
  const addItem = useStore((s) => s.addItem)

  const [bucket, setBucket] = useState(area.habitBucket)
  const [draft, setDraft] = useState('')

  const thisWeek = sessionCountSince(logs, startOfWeekKey())
  const history = useMemo(
    () => sessionDates(logs).slice(0, 6).map((d) => sessionSummary(logs, d)),
    [logs],
  )

  const shown = items.filter((i) => i.bucket === bucket)

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
        <span className="fin-sub">{thisWeek} of {SESSIONS.length} this week</span>
      </div>

      <SessionLogger logs={logs} date={date} weekday={weekday} />

      <div className="fin-grid">
        <div className="fin-col">
          <ProgressChart logs={logs} />

          <section className="fin-section card">
            <h3>Recent sessions</h3>
            {history.length === 0 ? (
              <div className="empty-note">No sessions logged yet.</div>
            ) : (
              history.map((h) => (
                <div key={h.date} className="fin-row">
                  <span className="fin-grow">
                    {shortDate(h.date)}
                    <span className="fin-sub"> · {h.session?.name ?? 'Ad hoc'}</span>
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
          <ProgramCard />

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
