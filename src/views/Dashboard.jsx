import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Flame, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { levelForPoints, levelProgress, habitStreak, todayKey } from '../lib/rewards'
import { AREAS, areaById } from '../data/areas'
import ProgressRing from '../components/ProgressRing'
import ActivityChart from '../components/ActivityChart'
import ItemSheet from '../components/ItemSheet'

const PRIORITY_AREAS = AREAS.filter((a) => a.habitBucket)
const QUOTE_INTERVAL_MS = 8000
const ACADEMIA_LIMIT = 5
const PROJECT_NOTES_LIMIT = 5

function priorityItemsFor(area, items) {
  return items.filter(
    (i) => !i.deletedAt && i.areaId === area.id && i.bucket === area.habitBucket && i.status !== 'archived',
  )
}

/** Today's checklist for one area's habit bucket (Fitness's Top Priorities, Diet's Today's Meals, ...). */
function PriorityAreaSection({ area, items, logs, toggleHabitCheck, onOpen }) {
  const priorityItems = priorityItemsFor(area, items)
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
                onClick={() => toggleHabitCheck(item.id)}
                aria-label={`Check ${item.title}`}
              >
                <Check size={15} strokeWidth={2.5} />
              </button>
              <div className="item-title">{item.title}</div>
              <div className="streak"><Flame size={13} strokeWidth={1.75} /><b>{habitStreak(logs, item.id)}</b></div>
              <button className="detail-btn" onClick={() => onOpen(item)} aria-label="Details"><ChevronRight size={17} strokeWidth={1.75} /></button>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Up to ACADEMIA_LIMIT open items from the Academia library, most recently touched first. */
function AcademiaSection({ items, onOpen }) {
  const area = areaById('academia')
  const openItems = items
    .filter((i) => !i.deletedAt && i.areaId === 'academia' && i.status === 'open')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, ACADEMIA_LIMIT)

  return (
    <>
      <div className="column-title">{area.name}</div>
      {openItems.length === 0 ? (
        <div className="empty-note">Nothing queued — add a book, video, or podcast.</div>
      ) : (
        <div className="item-list">
          {openItems.map((item) => (
            <div key={item.id} className="item-row">
              <div className="item-title">{item.title}</div>
              {item.bucket && <span className="chip">{item.bucket}</span>}
              <button className="detail-btn" onClick={() => onOpen(item)} aria-label="Details"><ChevronRight size={17} strokeWidth={1.75} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Up to PROJECT_NOTES_LIMIT most recent notes across every project, newest first. */
function ProjectNotesSection({ items, notes }) {
  const navigate = useNavigate()
  const recentNotes = notes
    .filter((n) => !n.deletedAt && n.areaId === 'projects' && n.itemId != null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, PROJECT_NOTES_LIMIT)

  return (
    <>
      <div className="column-title">Last Project Notes</div>
      {recentNotes.length === 0 ? (
        <div className="empty-note">No project notes yet.</div>
      ) : (
        <div className="item-list">
          {recentNotes.map((note) => {
            const project = items.find((i) => i.id === note.itemId)
            return (
              <div
                key={note.id}
                className="card note-card clickable"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${note.itemId}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${note.itemId}`)}
              >
                <div className="note-date">{project?.title ?? 'Deleted project'} · {new Date(note.createdAt).toLocaleDateString()}</div>
                <div className="note-text">{note.text}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function Dashboard({ onAdd }) {
  const points = useStore((s) => s.points)
  const items = useStore((s) => s.items)
  const logs = useStore((s) => s.logs)
  const notes = useStore((s) => s.notes)
  const toggleHabitCheck = useStore((s) => s.toggleHabitCheck)
  const [open, setOpen] = useState(null)

  const level = levelForPoints(points)
  const progress = levelProgress(points)

  const habits = items.filter((i) => !i.deletedAt && i.areaId === 'habits' && i.status !== 'archived')
  const checkedToday = habits.filter((h) =>
    logs.some((l) => l.itemId === h.id && l.kind === 'habit-check' && l.date === todayKey() && !l.deletedAt),
  )

  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const quotes = items.filter((i) => !i.deletedAt && i.areaId === 'philosophy' && i.status !== 'archived')
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes
  const [quoteIndex, setQuoteIndex] = useState(0)
  const nextQuote = () => setQuoteIndex((i) => (quotesRef.current.length ? (i + 1) % quotesRef.current.length : 0))
  // Keyed on the index rather than a bare interval, so tapping through
  // quotes restarts the dwell time instead of racing a fixed tick.
  useEffect(() => {
    const id = setTimeout(nextQuote, QUOTE_INTERVAL_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteIndex])
  const quote = quotes.length > 0 ? quotes[quoteIndex % quotes.length] : null

  return (
    <div className="page">
      <div className="dash-grid">
        <div className="dash-main">
          <div className="card hero-card">
            {/* Every line here is a fixed height: the quote rotates on its
                own, and text that reflows under it moves the whole card. */}
            <div className="hero-meta">
              <p className="hero-stats">
                <span className="level">Level {level}</span>
                <b>{points}</b> pts · {Math.round(progress * 100)}% to L{level + 1}
              </p>
              {quote ? (
                <button className="hero-quote" onClick={nextQuote} aria-label="Show another quote">
                  “{quote.title}”
                </button>
              ) : (
                <p className="hero-quote">{greet}, Ryan</p>
              )}
            </div>
            <ProgressRing progress={progress} label={`L${level}`} />
          </div>

          <button className="dash-add" onClick={onAdd}>
            <Plus size={16} strokeWidth={2} />Quick add
          </button>

          <ActivityChart logs={logs} notes={notes} />

          <div className="dash-row">
            <div className="dash-col">
              <AcademiaSection items={items} onOpen={setOpen} />
            </div>
            <div className="dash-col">
              <ProjectNotesSection items={items} notes={notes} />
            </div>
          </div>
        </div>

        <div className="dash-side">
          <div className="column-title">My Priorities</div>
          {habits.length > 0 && (
            <>
              <div className="section-label">Today's keystones</div>
              <div className="item-list">
                {habits.map((h) => {
                  const on = checkedToday.some((c) => c.id === h.id)
                  return (
                    <div key={h.id} className="item-row habit-row">
                      <button className={`habit-check ${on ? 'on' : ''}`} onClick={() => toggleHabitCheck(h.id)} aria-label={`Check ${h.title}`}><Check size={15} strokeWidth={2.5} /></button>
                      <div className="item-title">{h.title}</div>
                      <div className="streak"><b>{habitStreak(logs, h.id)}</b> day streak</div>
                      <button className="detail-btn" onClick={() => setOpen(h)} aria-label="Details"><ChevronRight size={17} strokeWidth={1.75} /></button>
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
              toggleHabitCheck={toggleHabitCheck}
              onOpen={setOpen}
            />
          ))}
        </div>
      </div>

      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
