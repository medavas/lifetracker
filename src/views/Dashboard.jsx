import { Link } from 'react-router-dom'
import { Check, Flame } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectJournal } from '../lib/store'
import { levelForPoints, levelProgress, habitStreak, dailyActivity, dailyPresence, todayKey, QUARTER_WEEKS } from '../lib/rewards'
import { AREAS } from '../data/areas'
import ProgressRing from '../components/ProgressRing'
import DailyStack from '../components/DailyStack'
import PracticeGrid from '../components/PracticeGrid'

const PRIORITY_AREAS = AREAS.filter((a) => a.habitBucket)

/** Today's checklist for one area's habit bucket (Fitness's Top Priorities, Diet's Today's Meals, ...). */
function PriorityAreaSection({ area, items, logs, toggleHabitToday }) {
  const priorityItems = items.filter(
    (i) => i.areaId === area.id && i.bucket === area.habitBucket && i.status !== 'archived',
  )
  if (priorityItems.length === 0) return null

  return (
    <>
      <div className="section-label">{area.name}: {area.habitBucket}</div>
      <div className="item-list">
        {priorityItems.map((item) => {
          const checkedToday = logs.some(
            (l) => l.itemId === item.id && l.kind === 'habit-check' && l.date === todayKey() && !l.deletedAt,
          )
          return (
            <div key={item.id} className="item-row habit-row">
              <button
                className={`habit-check ${checkedToday ? 'on' : ''}`}
                onClick={() => toggleHabitToday(item.id)}
                aria-label={`Check ${item.title}`}
              >
                <Check size={15} strokeWidth={2.5} />
              </button>
              <div className="item-title">{item.title}</div>
              <div className="streak"><Flame size={13} strokeWidth={1.75} /><b>{habitStreak(logs, item.id)}</b></div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function Dashboard() {
  const points = useStore((s) => s.points)
  const items = useStore((s) => s.items)
  const logs = useStore((s) => s.logs)
  const notes = useStore((s) => s.notes)
  const toggleHabitToday = useStore((s) => s.toggleHabitToday)
  const journal = useStore(useShallow(selectJournal))

  const level = levelForPoints(points)
  const progress = levelProgress(points)

  const habits = items.filter((i) => i.areaId === 'habits' && i.status !== 'archived')
  const checkedToday = habits.filter((h) =>
    logs.some((l) => l.itemId === h.id && l.kind === 'habit-check' && l.date === todayKey()),
  )
  const bestStreak = habits.reduce((m, h) => Math.max(m, habitStreak(logs, h.id)), 0)
  const doneToday = logs.filter((l) => l.kind === 'complete' && l.date === todayKey()).length

  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page">
      <div className="dash-grid">
        <div className="dash-main">
          <div className="card hero-card">
            <div className="hero-meta">
              <p className="greet">{greet}, Ryan</p>
              <p className="level">Level {level}</p>
              <p className="pts"><b>{points}</b> pts · {Math.round(progress * 100)}% to L{level + 1}</p>
            </div>
            <ProgressRing progress={progress} label={`L${level}`} />
          </div>

          <div className="tile-row">
            <div className="card stat-tile">
              <div className="stat-value">{checkedToday.length}/{habits.length || 0}</div>
              <div className="stat-label">habits today</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-value">{bestStreak}</div>
              <div className="stat-label">best streak (days)</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-value">{doneToday}</div>
              <div className="stat-label">done today</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-value">{journal.length}</div>
              <div className="stat-label">journal entries</div>
            </div>
          </div>

          {habits.length > 0 && (
            <>
              <div className="section-label">Today's keystones</div>
              <div className="item-list">
                {habits.map((h) => {
                  const on = checkedToday.some((c) => c.id === h.id)
                  return (
                    <div key={h.id} className="item-row habit-row">
                      <button className={`habit-check ${on ? 'on' : ''}`} onClick={() => toggleHabitToday(h.id)} aria-label={`Check ${h.title}`}><Check size={15} strokeWidth={2.5} /></button>
                      <div className="item-title">{h.title}</div>
                      <div className="streak"><b>{habitStreak(logs, h.id)}</b> day streak</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {PRIORITY_AREAS.map((area) => (
            <PriorityAreaSection
              key={area.id}
              area={area}
              items={items}
              logs={logs}
              toggleHabitToday={toggleHabitToday}
            />
          ))}

          <div className="section-label">Last 7 days</div>
          <div className="card">
            <DailyStack data={dailyActivity(logs, notes, 7)} />
          </div>

          <div className="section-label">Last {QUARTER_WEEKS} weeks</div>
          <div className="card">
            <PracticeGrid weeks={dailyPresence(logs, notes, QUARTER_WEEKS)} />
          </div>
        </div>

        <div className="dash-side">
          {(() => {
            const quotes = useStore
              .getState()
              .items.filter((i) => i.areaId === 'philosophy' && i.status !== 'archived')
            if (quotes.length === 0) return null
            return (
              <>
                <div className="section-label">Quotes</div>
                <Link to="/area/philosophy">
                  <div className="card note-card">
                    {quotes.slice(0, 5).map((q, i) => (
                      <p
                        key={q.id}
                        className="note-text"
                        style={{ fontStyle: 'italic', marginTop: i === 0 ? 0 : 10 }}
                      >
                        “{q.title}”
                      </p>
                    ))}
                  </div>
                </Link>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
