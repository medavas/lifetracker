import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronRight, GripVertical } from 'lucide-react'
import { useStore } from '../lib/store'
import ItemSheet from './ItemSheet'

function SortableRow({ item, onOpen }) {
  const toggleDone = useStore((s) => s.toggleDone)
  const updateItem = useStore((s) => s.updateItem)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== item.title) updateItem(item.id, { title: draft.trim() })
    else setDraft(item.title)
  }

  return (
    <div
      ref={setNodeRef}
      className={`item-row ${item.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className={`check ${item.status === 'done' ? 'on' : ''}`}
        onClick={() => toggleDone(item.id)}
        aria-label={item.status === 'done' ? 'Mark not done' : 'Mark done'}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>
      <div className="item-title" onClick={() => !editing && setEditing(true)}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          item.title
        )}
      </div>
      <button className="detail-btn" onClick={() => onOpen(item)} aria-label="Details">
        <ChevronRight size={17} strokeWidth={1.75} />
      </button>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}

/**
 * Generic sortable item list: check, inline title edit, details sheet,
 * drag-drop reorder. Archive lives in the details sheet — unchecking is
 * NOT archiving.
 */
export default function ItemList({ items, areaId }) {
  const reorderItems = useStore((s) => s.reorderItems)
  const [open, setOpen] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = items.map((i) => i.id)
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))
    reorderItems(areaId, next)
  }

  if (items.length === 0) return <div className="empty-note">Nothing here yet — add something below.</div>

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="item-list">
            {items.map((item) => (
              <SortableRow key={item.id} item={item} onOpen={setOpen} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {open && <ItemSheet item={open} onClose={() => setOpen(null)} />}
    </>
  )
}
