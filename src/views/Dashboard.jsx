import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectJournal } from '../lib/store'
import { levelForPoints, levelProgress, habitStreak, dailyActivity, dailyPresence, todayKey } from '../lib/rewards'
import ProgressRing from '../components/ProgressRing'
import DailyStack from '../components/DailyStack'
import PracticeGrid from '../components/PracticeGrid'

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
  const latestEntry = journal[0]

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

          <div className="section-label">Last 7 days</div>
          <div className="card">
            <DailyStack data={dailyActivity(logs, notes, 7)} />
          </div>

          <div className="section-label">Last 5 weeks</div>
          <div className="card">
            <PracticeGrid weeks={dailyPresence(logs, notes, 5)} />
          </div>
        </div>

        <div className="dash-side">
          {latestEntry && (() => {
            const d = new Date(latestEntry.createdAt)
            return (
              <>
                <div className="section-label">Latest journal</div>
                <Link to={`/journal/years/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`}>
                  <div className="card note-card">
                    <div className="note-date">{d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                    <div className="note-text">
                      {latestEntry.text.length > 160 ? latestEntry.text.slice(0, 160) + '…' : latestEntry.text}
                    </div>
                  </div>
                </Link>
              </>
            )
          })()}

          {(() => {
            const quotes = useStore
              .getState()
              .items.filter((i) => i.areaId === 'philosophy' && i.status !== 'archived')
            if (quotes.length === 0) return null
            const q = quotes[new Date().getDate() % quotes.length]
            return (
              <>
                <div className="section-label">Thought of the day</div>
                <Link to="/area/philosophy">
                  <div className="card note-card">
                    <div className="note-text" style={{ fontStyle: 'italic' }}>“{q.title}”</div>
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
