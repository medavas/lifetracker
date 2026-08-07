import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { suggestAreas } from '../lib/fuzzy'
import { AREAS, routeFor } from '../data/areas'
import AreaIcon from './AreaIcon'

/**
 * Quick capture from anywhere: type a thought, fuzzy-match suggests the
 * area(s) it belongs to, one tap files it — as an item, or a journal line.
 */
export default function QuickAdd({ onClose }) {
  const [text, setText] = useState('')
  const addItem = useStore((s) => s.addItem)
  const addNote = useStore((s) => s.addNote)
  const navigate = useNavigate()

  // A nudge needs an interval, which free-text capture never supplies, so
  // 'timers' areas are not a valid QuickAdd destination -- they're excluded
  // from both the fuzzy-matched suggestions and the fallback chips.
  const suggestions = useMemo(
    () => suggestAreas(text).filter((a) => a.kind !== 'timers'),
    [text],
  )
  const fallback = AREAS.filter((a) => a.kind !== 'timers' && !suggestions.includes(a)).slice(
    0,
    suggestions.length ? 2 : 5,
  )

  const fileTo = (area) => {
    if (!text.trim()) return
    if (area.kind === 'journal') addNote('journal', text)
    // Money-kind items with no bucket resolve to bucket: null, which no
    // dashboard section's `bucket === X` filter matches — they'd be
    // invisible. 'Other' is the dashboard's catch-all bucket, so default
    // QuickAdd captures there instead.
    else if (area.kind === 'money') addItem(area.id, text, { bucket: 'Other' })
    else addItem(area.id, text)
    onClose()
    navigate(routeFor(area))
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Quick add">
        <div className="sheet-grab" />
        <h2>Capture</h2>
        <div className="field">
          <textarea
            autoFocus
            rows={3}
            value={text}
            placeholder="What's on your mind? e.g. “pay car insurance bill friday”"
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {text.trim() && (
          <>
            {suggestions.length > 0 && <div className="section-label">Looks like…</div>}
            <div className="link-chips">
              {suggestions.map((a) => (
                <button key={a.id} className="chip on" onClick={() => fileTo(a)}>
                  <AreaIcon name={a.icon} size={13} /> {a.name}
                </button>
              ))}
            </div>
            <div className="section-label">Or file under</div>
            <div className="link-chips">
              {fallback.map((a) => (
                <button key={a.id} className="chip" onClick={() => fileTo(a)}>
                  <AreaIcon name={a.icon} size={13} /> {a.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
