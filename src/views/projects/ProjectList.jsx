import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
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

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`item-row ${!hasSubItems && project.status === 'done' ? 'done' : ''}`}
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
  const allItems = useStore(useShallow(selectAreaItems('projects')))
  const topLevel = useMemo(() => allItems.filter((i) => !i.parentId), [allItems])

  const [bucket, setBucket] = useState('All')
  const [draft, setDraft] = useState('')

  const projects = useMemo(
    () => (bucket === 'All' ? topLevel : topLevel.filter((i) => i.bucket === bucket)),
    [topLevel, bucket],
  )

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

      {projects.length === 0 && <div className="empty-note">No projects yet. Add one below.</div>}

      <div className="item-list">
        {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
      </div>

      <div className="add-row">
        <input
          value={draft}
          placeholder={`Add to ${bucket === 'All' ? 'Projects' : bucket}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>
    </>
  )
}
