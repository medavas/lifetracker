import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { suggestAreas } from '../../lib/fuzzy'
import AreaIcon from '../../components/AreaIcon'

/**
 * Compose box for today's journal entry. Rendered on every Journal screen
 * (Year list, Month list, Day list, Day detail) -- always writes to
 * *today's* date via addNote, regardless of which year/month/day the user
 * is currently browsing.
 */
export default function TodayCompose() {
  const addNote = useStore((s) => s.addNote)
  const addItem = useStore((s) => s.addItem)

  const [draft, setDraft] = useState('')
  const [alsoFile, setAlsoFile] = useState([])

  const related = useMemo(() => suggestAreas(draft).filter((a) => a.kind !== 'journal'), [draft])

  const save = () => {
    if (!draft.trim()) return
    addNote('journal', draft)
    for (const areaId of alsoFile) addItem(areaId, draft.split('\n')[0].slice(0, 120))
    setDraft('')
    setAlsoFile([])
  }

  return (
    <div className="journal-compose">
      <textarea
        value={draft}
        placeholder="What happened? What's true today?"
        onChange={(e) => setDraft(e.target.value)}
      />
      {related.length > 0 && (
        <div className="link-chips">
          {related.map((a) => (
            <button
              key={a.id}
              className={`chip ${alsoFile.includes(a.id) ? 'on' : ''}`}
              onClick={() =>
                setAlsoFile((prev) =>
                  prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                )
              }
            >
              <AreaIcon name={a.icon} size={13} /> {a.name}
            </button>
          ))}
        </div>
      )}
      <div className="compose-foot">
        <span className="hint">
          {related.length > 0 ? 'Tap a chip to also file this as an item there.' : 'First entry of the day earns bonus points.'}
        </span>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}
