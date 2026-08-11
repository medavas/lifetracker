import { useState } from 'react'
import { StretchHorizontal } from 'lucide-react'
import { useStore } from '../../lib/store'
import { useBackDismiss } from '../../lib/useBackDismiss'

/**
 * Tap a stretch to rename it, move it, or drop it.
 *
 * The move chips are not a fallback for dragging — on a phone they are the
 * primary path. Dragging a card between stacked columns means scrolling
 * mid-drag, which no touch drag library handles well; picking the
 * destination by name always works.
 */
export default function StretchSheet({ stretch, categories, onClose }) {
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const moveSubItem = useStore((s) => s.moveSubItem)
  const items = useStore((s) => s.items)

  const [title, setTitle] = useState(stretch.title)
  const [details, setDetails] = useState(stretch.details ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const move = (categoryId) => {
    if (categoryId === stretch.parentId) return
    // Land it at the end of the destination, which is where a person
    // expects a thing they just filed to be.
    const destination = items
      .filter((i) => !i.deletedAt && i.parentId === categoryId && i.status !== 'archived')
      .sort((a, b) => a.order - b.order)
      .map((i) => i.id)
    moveSubItem(stretch.id, categoryId, [...destination, stretch.id])
    onClose()
  }

  const save = () => {
    updateItem(stretch.id, { title: title.trim() || stretch.title, details })
    onClose()
  }

  useBackDismiss(save)

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Edit stretch">
        <div className="sheet-grab" />
        <h2><StretchHorizontal size={16} /> Edit stretch</h2>

        <div className="field">
          <label>Stretch</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="How long to hold it, what it should feel like…" />
        </div>

        <div className="field">
          <label>Category</label>
          <div className="link-chips">
            {categories.map((c) => (
              <button
                key={c.id} className={`chip ${c.id === stretch.parentId ? 'on' : ''}`}
                onClick={() => move(c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn-primary" onClick={save}>Save</button>
          <button
            className="btn-ghost btn-danger"
            onClick={() => {
              if (confirmDelete) { deleteItem(stretch.id); onClose() }
              else setConfirmDelete(true)
            }}
          >
            {confirmDelete ? 'Sure?' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}
