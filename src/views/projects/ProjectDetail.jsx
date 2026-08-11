import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Plus, GripVertical, Trash2 } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectItemNotes, selectSubItems } from '../../lib/store'
import { areaById } from '../../data/areas'

/** One row in a project's checklist: title, checkbox, delete, drag handle -- no notes, no further drill-down. */
function SortableSubTask({ item, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      className={`item-row ${item.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className={`check ${item.status === 'done' ? 'on' : ''}`}
        onClick={() => onToggle(item.id)}
        aria-label={item.status === 'done' ? 'Mark not done' : 'Mark done'}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>
      <div className="item-title">{item.title}</div>
      <button
        className="detail-btn"
        onClick={() => onDelete(item.id)}
        aria-label={`Delete ${item.title}`}
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}

/**
 * A single project: title, details, bucket, its sub-task checklist, and
 * its notes feed. Fully replaces what ItemSheet gave a project -- ItemSheet
 * is not used here. A project with any live sub-task has no checkbox of
 * its own; completion is derived (see store.js's syncParentCompletion) and
 * only ever changes by finishing the sub-tasks.
 *
 * Title/details auto-save on blur rather than an explicit Save button --
 * a deliberate choice for a full page rather than a dismissable sheet.
 */
export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  // zustand's persist middleware hydrates from IndexedDB asynchronously, so
  // on first mount a real, existing project can briefly read as `undefined`
  // -- this distinguishes "still loading" from "genuinely gone" so a fresh
  // page load doesn't flash a false "no longer exists" message. Hydration
  // calls set() internally, which re-renders this component once it's
  // done, so no extra subscription is needed beyond reading this each render.
  const hydrated = useStore.persist.hasHydrated()

  // A sub-task's id or a foreign-area item's id must resolve exactly like a
  // nonexistent id does here -- this is the only route into ProjectDetail,
  // and nothing upstream stops a URL from naming either (see finding #3:
  // the one-level nesting cap and "Projects only" are otherwise just
  // conventions with no code enforcing them at this seam).
  const project = useStore((s) => {
    const item = s.items.find((i) => i.id === projectId && !i.deletedAt)
    return item && !item.parentId && item.areaId === 'projects' ? item : undefined
  })
  const updateItem = useStore((s) => s.updateItem)
  const toggleDone = useStore((s) => s.toggleDone)
  const archiveItem = useStore((s) => s.archiveItem)
  const restoreItem = useStore((s) => s.restoreItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const addItem = useStore((s) => s.addItem)
  const reorderSubItems = useStore((s) => s.reorderSubItems)
  const addNote = useStore((s) => s.addNote)

  const notes = useStore(useShallow(selectItemNotes(projectId)))
  const subItems = useStore(useShallow(selectSubItems(projectId)))

  const [title, setTitle] = useState(project?.title ?? '')
  const [details, setDetails] = useState(project?.details ?? '')
  const [noteDraft, setNoteDraft] = useState('')
  const [subDraft, setSubDraft] = useState('')

  // The useState initializers above only run once, at first mount -- if
  // hydration is still in flight then (project undefined), title/details
  // permanently capture '' unless we resync here. This effect covers both
  // that async-hydration race and a future case where the route's
  // projectId changes without a remount (React Router doesn't remount on
  // a param change alone), so stale typed fields from one project can't
  // leak into another's display.
  useEffect(() => {
    if (project) {
      setTitle(project.title)
      setDetails(project.details)
    }
  }, [project?.id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  if (!project) {
    return (
      <>
        <div className="page-head">
          <button className="back-btn" onClick={() => navigate('/projects')}>
            <ChevronLeft size={16} strokeWidth={1.75} />Back
          </button>
        </div>
        <div className="empty-note">{hydrated ? 'This project no longer exists.' : 'Loading…'}</div>
      </>
    )
  }

  const area = areaById(project.areaId)
  const archived = project.status === 'archived'

  const save = () => updateItem(projectId, { title: title.trim() || project.title, details })

  const addSubTask = () => {
    if (!subDraft.trim()) return
    addItem('projects', subDraft, { parentId: projectId })
    setSubDraft('')
  }

  const addProjectNote = () => {
    if (!noteDraft.trim()) return
    addNote(project.areaId, noteDraft, projectId)
    setNoteDraft('')
  }

  const onSubDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = subItems.map((i) => i.id)
    reorderSubItems(projectId, arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  return (
    <>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate('/projects')}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>

      <div className="field">
        <label>Details</label>
        <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} onBlur={save} placeholder="Notes, links, context…" />
      </div>

      {area?.buckets.length > 0 && (
        <div className="field">
          <label>Bucket</label>
          <div className="link-chips">
            {area.buckets.map((b) => (
              <button
                key={b}
                className={`chip ${project.bucket === b ? 'on' : ''}`}
                onClick={() => updateItem(projectId, { bucket: project.bucket === b ? null : b })}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label>
          {subItems.length > 0
            ? `Sub-tasks (${subItems.filter((i) => i.status === 'done').length}/${subItems.length})`
            : 'Sub-tasks'}
        </label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubDragEnd}>
          <SortableContext items={subItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="item-list">
              {subItems.map((item) => (
                <SortableSubTask key={item.id} item={item} onToggle={toggleDone} onDelete={deleteItem} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="add-row">
          <input
            value={subDraft}
            placeholder="Add a sub-task…"
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubTask()}
          />
          <button onClick={addSubTask} aria-label="Add sub-task"><Plus size={20} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="field">
        <label>Notes ({notes.length})</label>
        {notes.map((n) => (
          <div key={n.id} className="card note-card">
            <div className="note-date">{new Date(n.createdAt).toLocaleString()}</div>
            <div className="note-text">{n.text}</div>
          </div>
        ))}
        <div className="add-row">
          <input
            value={noteDraft}
            placeholder="Add a note…"
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProjectNote()}
          />
          <button onClick={addProjectNote} aria-label="Add note"><Plus size={20} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="sheet-actions">
        {subItems.length === 0 && (
          <button
            className={`check ${project.status === 'done' ? 'on' : ''}`}
            onClick={() => toggleDone(projectId)}
            aria-label="Toggle project done"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
        )}
        {archived ? (
          <button className="btn-ghost" onClick={() => restoreItem(projectId)}>Restore</button>
        ) : (
          <button className="btn-ghost" onClick={() => archiveItem(projectId)}>Archive</button>
        )}
      </div>
    </>
  )
}
