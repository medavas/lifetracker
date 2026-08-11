import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Plus, X } from 'lucide-react'
import { useStore } from '../../lib/store'
import { useBackDismiss } from '../../lib/useBackDismiss'
import { STRETCH_BUCKET } from '../../data/stretches'
import StretchSheet from './StretchSheet'

function StretchCard({ stretch, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stretch.id })

  return (
    <div
      ref={setNodeRef}
      className={`st-card ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="drag-handle" {...attributes} {...listeners} aria-label={`Drag ${stretch.title}`}>
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
      <button className="st-title" onClick={() => onEdit(stretch)}>
        {stretch.title}
        {stretch.details?.trim() && <span className="st-note">{stretch.details}</span>}
      </button>
      <button className="wo-info" onClick={() => onEdit(stretch)} aria-label={`Edit ${stretch.title}`}>
        <Pencil size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}

/**
 * A category column. It is a drop target in its own right, not just a list of
 * them — without that, an empty category could never receive anything, which
 * is the one move a board like this has to support.
 */
function Category({ category, stretches, onEdit, onRename, onDelete }) {
  const addItem = useStore((s) => s.addItem)
  const { setNodeRef, isOver } = useDroppable({ id: category.id })
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(category.title)

  const add = () => {
    if (!draft.trim()) return
    addItem('fitness', draft, { parentId: category.id })
    setDraft('')
  }

  const commitRename = () => {
    setRenaming(false)
    if (name.trim() && name !== category.title) onRename(category.id, name.trim())
    else setName(category.title)
  }

  return (
    <section className={`st-col card ${isOver ? 'over' : ''}`}>
      <div className="st-col-head">
        {renaming ? (
          <input
            autoFocus className="st-rename" value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          />
        ) : (
          <button className="st-col-title" onClick={() => setRenaming(true)}>
            {category.title}
          </button>
        )}
        <span className="fin-sub">{stretches.length}</span>
        <button className="wo-info" onClick={() => onDelete(category)} aria-label={`Delete ${category.title}`}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div ref={setNodeRef} className="st-drop">
        <SortableContext items={stretches.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stretches.length === 0 ? (
            <p className="st-empty">Drop a stretch here, or add one below.</p>
          ) : (
            stretches.map((s) => <StretchCard key={s.id} stretch={s} onEdit={onEdit} />)
          )}
        </SortableContext>
      </div>

      <div className="fin-addrow">
        <input
          className="fin-title" placeholder="Add a stretch…"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="fin-add" onClick={add} aria-label={`Add to ${category.title}`}>
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
    </section>
  )
}

/**
 * The stretch board: your stretches, filed into categories you name, moved
 * between them by dragging.
 *
 * Categories are parent items and stretches are their sub-items — the same
 * one-level nesting the workout program uses — so "move to another category"
 * is just a change of parentId, and rename/reorder/delete all come from the
 * machinery that already exists.
 *
 * All the work happens on drop rather than continuously during the drag.
 * Re-parenting mid-drag is where multi-container drag-and-drop usually goes
 * wrong, and a stretch board does not need a live preview badly enough to
 * take that on.
 */
export default function StretchBoard({ categories, allItems }) {
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const reorderSubItems = useStore((s) => s.reorderSubItems)
  const moveSubItem = useStore((s) => s.moveSubItem)
  const seedStretchCategories = useStore((s) => s.seedStretchCategories)

  const [editing, setEditing] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [newCategory, setNewCategory] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useBackDismiss(() => setConfirmDelete(null), confirmDelete != null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  const byCategory = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, []]))
    for (const i of allItems) {
      if (i.deletedAt || i.status === 'archived' || !i.parentId) continue
      map.get(i.parentId)?.push(i)
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [categories, allItems])

  const stretchById = (id) => {
    for (const list of byCategory.values()) {
      const hit = list.find((s) => s.id === id)
      if (hit) return hit
    }
    return null
  }

  /** A drop target is either a column itself or a card sitting in one. */
  const containerOf = (id) =>
    byCategory.has(id) ? id : (stretchById(id)?.parentId ?? null)

  const onDragEnd = ({ active, over }) => {
    setDragging(null)
    if (!over) return
    const from = containerOf(active.id)
    const to = containerOf(over.id)
    if (!from || !to) return

    const target = byCategory.get(to).map((s) => s.id)
    if (from === to) {
      const oldIndex = target.indexOf(active.id)
      const newIndex = over.id === to ? target.length - 1 : target.indexOf(over.id)
      if (oldIndex === newIndex || newIndex < 0) return
      target.splice(newIndex, 0, ...target.splice(oldIndex, 1))
      reorderSubItems(to, target)
      return
    }
    // Dropping onto the column (not a card) appends; onto a card inserts there.
    const at = over.id === to ? target.length : Math.max(0, target.indexOf(over.id))
    target.splice(at, 0, active.id)
    moveSubItem(active.id, to, target)
  }

  const addCategory = () => {
    if (!newCategory?.trim()) return
    addItem('fitness', newCategory, { bucket: STRETCH_BUCKET })
    setNewCategory(null)
  }

  if (categories.length === 0) {
    return (
      <section className="fin-section card">
        <h3>No categories yet</h3>
        <p className="wo-hint">
          Start with categories named for what actually limits the lifts — hips and ankles cap
          squat depth, hamstrings cap the RDL — then fill them with the stretches you care about.
          Rename or delete any of them.
        </p>
        <div className="wo-entry">
          <button className="btn-primary" onClick={seedStretchCategories}>Add starter categories</button>
          <button className="btn-ghost" onClick={() => setNewCategory('')}>Start empty</button>
        </div>
        {newCategory != null && (
          <div className="fin-addrow">
            <input
              className="fin-title" autoFocus placeholder="Name a category, e.g. Hips"
              value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <button className="fin-add" onClick={addCategory}>Add</button>
          </div>
        )}
      </section>
    )
  }

  return (
    <>
      <div className="st-toolbar">
        <span className="fin-sub">Drag a stretch between categories, or tap it to move it.</span>
        <button className="fin-add" onClick={() => setNewCategory('')}>
          <Plus size={14} strokeWidth={2.25} />Category
        </button>
      </div>

      {newCategory != null && (
        <div className="fin-addrow st-newcat">
          <input
            className="fin-title" autoFocus placeholder="Name a category, e.g. Hips"
            value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button className="fin-add" onClick={addCategory}>Add</button>
          <button className="fin-add" onClick={() => setNewCategory(null)}>Cancel</button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setDragging(stretchById(active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="st-board">
          {categories.map((c) => (
            <Category
              key={c.id}
              category={c}
              stretches={byCategory.get(c.id) ?? []}
              onEdit={setEditing}
              onRename={(id, title) => updateItem(id, { title })}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging && (
            <div className="st-card dragging-overlay">
              <span className="drag-handle"><GripVertical size={15} strokeWidth={1.75} /></span>
              <span className="st-title">{dragging.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editing && (
        <StretchSheet stretch={editing} categories={categories} onClose={() => setEditing(null)} />
      )}

      {confirmDelete && (
        <>
          <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="sheet" role="dialog" aria-label="Delete category">
            <div className="sheet-grab" />
            <h2>Delete “{confirmDelete.title}”?</h2>
            <p className="wo-hint">
              {(byCategory.get(confirmDelete.id) ?? []).length === 0
                ? 'The category is empty, so nothing else goes with it.'
                : `Its ${byCategory.get(confirmDelete.id).length} stretches go with it. Move them first if you want to keep them.`}
            </p>
            <div className="sheet-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn-ghost btn-danger"
                onClick={() => { deleteItem(confirmDelete.id); setConfirmDelete(null) }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
