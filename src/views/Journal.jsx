import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectJournal } from '../lib/store'
import { suggestAreas } from '../lib/fuzzy'
import AreaIcon from '../components/AreaIcon'

/**
 * Journal: write freely; fuzzy-match surfaces related areas so a line like
 * "need to move savings over" can also be filed as an item where it belongs.
 */
export default function Journal() {
  const [draft, setDraft] = useState('')
  const [alsoFile, setAlsoFile] = useState([]) // area ids to also add as items
  const addNote = useStore((s) => s.addNote)
  const addItem = useStore((s) => s.addItem)
  const updateNote = useStore((s) => s.updateNote)
  const deleteNote = useStore((s) => s.deleteNote)
  const entries = useStore(useShallow(selectJournal))
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const related = useMemo(() => suggestAreas(draft).filter((a) => a.kind !== 'journal'), [draft])

  const save = () => {
    if (!draft.trim()) return
    addNote('journal', draft)
    for (const areaId of alsoFile) addItem(areaId, draft.split('\n')[0].slice(0, 120))
    setDraft('')
    setAlsoFile([])
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Journal</h1></div>

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

      {entries.length === 0 && <div className="empty-note">No entries yet. Start with today.</div>}

      {entries.map((n) => (
        <div key={n.id} className="card note-card">
          <div className="note-date">
            {new Date(n.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(n.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
          {editingId === n.id ? (
            <>
              <textarea
                style={{ width: '100%' }}
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="compose-foot">
                <span className="hint" />
                <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                <button className="btn-ghost btn-danger" onClick={() => { deleteNote(n.id); setEditingId(null) }}>Delete</button>
                <button className="btn-primary" onClick={() => { updateNote(n.id, editText); setEditingId(null) }}>Save</button>
              </div>
            </>
          ) : (
            <div className="note-text" onClick={() => { setEditingId(n.id); setEditText(n.text) }}>
              {n.text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
