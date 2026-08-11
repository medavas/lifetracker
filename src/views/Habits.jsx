import { useState } from 'react'
import { Check, ChevronRight, Flame, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { habitStreak, daysAgoKey } from '../lib/rewards'
import ItemSheet from '../components/ItemSheet'
import AreaIcon from '../components/AreaIcon'

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Keystone habits: daily checks, streaks, 7-day dot history per habit. */
export default function Habits() {
  const habits = useStore(useShallow(selectAreaItems('habits')))
  const logs = useStore((s) => s.logs)
  const toggleHabitCheck = useStore((s) => s.toggleHabitCheck)
  const addItem = useStore((s) => s.addItem)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(null)

  const add = () => {
    if (!draft.trim()) return
    addItem('habits', draft, { type: 'habit' })
    setDraft('')
  }

  // Unchecking tombstones the log rather than removing it, so a check that
  // ignores deletedAt reads as permanently on and the day can never be
  // toggled back off.
  const checkedOn = (habitId, date) =>
    logs.some((l) => l.itemId === habitId && l.kind === 'habit-check' && l.date === date && !l.deletedAt)

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-y)' }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name="KeyRound" /></div>
        <h1>Keystones</h1>
      </div>

      {habits.length === 0 && (
        <div className="empty-note">
          Keystone habits are the 2–4 daily actions everything else hangs on.
          <br />Add your first one below.
        </div>
      )}

      <div className="item-list">
        {habits.map((h) => {
          const streak = habitStreak(logs, h.id)
          const today = checkedOn(h.id, daysAgoKey(0))
          return (
            <div key={h.id} className="item-row habit-row">
              <button
                className={`habit-check ${today ? 'on' : ''}`}
                onClick={() => toggleHabitCheck(h.id)}
                aria-label={`Check ${h.title} for today`}
              >
                <Check size={16} strokeWidth={2.5} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">{h.title}</div>
                <div className="day-dots" aria-label="Last 7 days — tap a day to backfill it">
                  {[6, 5, 4, 3, 2, 1, 0].map((d) => {
                    const date = daysAgoKey(d)
                    const on = checkedOn(h.id, date)
                    return (
                      <button
                        key={d}
                        className={`day-dot ${on ? 'on' : ''} ${d === 0 ? 'today' : ''}`}
                        onClick={() => toggleHabitCheck(h.id, date)}
                        aria-label={`${on ? 'Uncheck' : 'Check'} ${h.title} for ${date}`}
                        aria-pressed={on}
                        title={date}
                      >
                        <span>{DAY_INITIALS[new Date(`${date}T00:00:00`).getDay()]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="streak"><Flame size={13} strokeWidth={1.75} /><b>{streak}</b></div>
              <button className="detail-btn" onClick={() => setOpen(h)} aria-label="Details"><ChevronRight size={17} strokeWidth={1.75} /></button>
            </div>
          )
        })}
      </div>

      <div className="add-row">
        <input
          value={draft}
          placeholder="Add a keystone habit…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>

      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
