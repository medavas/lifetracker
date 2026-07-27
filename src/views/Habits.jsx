import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { habitStreak, daysAgoKey } from '../lib/rewards'
import ItemSheet from '../components/ItemSheet'

/** Keystone habits: daily checks, streaks, 7-day dot history per habit. */
export default function Habits() {
  const habits = useStore(useShallow(selectAreaItems('habits')))
  const logs = useStore((s) => s.logs)
  const toggleHabitToday = useStore((s) => s.toggleHabitToday)
  const addItem = useStore((s) => s.addItem)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(null)

  const add = () => {
    if (!draft.trim()) return
    addItem('habits', draft, { type: 'habit' })
    setDraft('')
  }

  const checkedOn = (habitId, date) =>
    logs.some((l) => l.itemId === habitId && l.kind === 'habit-check' && l.date === date)

  return (
    <div className="page" style={{ '--area-c1': '#f59f00' }}>
      <div className="page-head">
        <div className="icon-chip" style={{ background: 'linear-gradient(135deg,#f59f0033,#ffd43b22)' }}>🔑</div>
        <h1>Keystone Habits</h1>
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
                onClick={() => toggleHabitToday(h.id)}
                aria-label={`Check ${h.title} for today`}
              >
                ✓
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">{h.title}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 5 }} aria-label="Last 7 days">
                  {[6, 5, 4, 3, 2, 1, 0].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: checkedOn(h.id, daysAgoKey(d)) ? 'var(--gold)' : 'var(--surface-3)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="streak"><b>{streak}</b>🔥</div>
              <button className="detail-btn" onClick={() => setOpen(h)} aria-label="Details">›</button>
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
        <button onClick={add} aria-label="Add">+</button>
      </div>

      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
