import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../../lib/store'
import { areaById } from '../../data/areas'

/** One top-level project: a plain checkbox if it has no live sub-tasks, progress ("3/5") if it does. */
function ProjectRow({ project }) {
  const items = useStore((s) => s.items)
  const toggleDone = useStore((s) => s.toggleDone)
  const subItems = useMemo(
    () => items.filter((i) => i.parentId === project.id && !i.deletedAt && i.status !== 'archived'),
    [items, project.id],
  )
  const hasSubItems = subItems.length > 0
  const doneCount = subItems.filter((i) => i.status === 'done').length

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })

  return (
    <Link
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      to={`/projects/${project.id}`}
      className={`item-row ${!hasSubItems && project.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      {!hasSubItems ? (
        <button
          className={`check ${project.status === 'done' ? 'on' : ''}`}
          // preventDefault (not stopPropagation) is what react-router-dom's
          // Link checks before navigating -- the documented way to nest an
          // interactive element inside a Link without triggering it.
          onClick={(e) => { e.preventDefault(); toggleDone(project.id) }}
          aria-label={project.status === 'done' ? 'Mark not done' : 'Mark done'}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      ) : (
        <div className="project-progress">{doneCount}/{subItems.length}</div>
      )}
      <div className="item-title">{project.title}</div>
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
        aria-label="Reorder"
      >
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </Link>
  )
}

/**
 * The list pane: bucket tabs plus every top-level project (no parentId).
 * Selecting one is always a real navigation to /projects/:id, never local
 * selection state -- see the design doc.
 */
export default function ProjectList() {
  const area = areaById('projects')
  const addItem = useStore((s) => s.addItem)
  const reorderItems = useStore((s) => s.reorderItems)

  const [bucket, setBucket] = useState('All')
  const [draft, setDraft] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const allItems = useStore(useShallow(selectAreaItems('projects', showArchived)))
  const topLevel = useMemo(() => allItems.filter((i) => !i.parentId), [allItems])

  const projects = useMemo(
    () => (bucket === 'All' ? topLevel : topLevel.filter((i) => i.bucket === bucket)),
    [topLevel, bucket],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = projects.map((p) => p.id)
    reorderItems('projects', arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  const add = () => {
    if (!draft.trim()) return
    addItem('projects', draft, { bucket: bucket === 'All' ? null : bucket })
    setDraft('')
  }

  return (
    <>
      <div className="page-head"><h1>Projects</h1></div>

      <div className="bucket-tabs">
        {['All', ...area.buckets].map((b) => (
          <button key={b} className={`bucket-tab ${bucket === b ? 'on' : ''}`} onClick={() => setBucket(b)}>
            {b}
          </button>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="empty-note">
          {showArchived ? 'No archived projects.' : 'No projects yet. Add one below.'}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="item-list">
            {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
          </div>
        </SortableContext>
      </DndContext>

      <div className="add-row">
        <input
          value={draft}
          placeholder={`Add to ${bucket === 'All' ? 'Projects' : bucket}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>

      <button className="archived-toggle" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Back to active' : 'View archived'}
      </button>
    </>
  )
}
