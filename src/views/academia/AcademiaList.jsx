import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Check, GripVertical, Plus, X } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems, selectAcademiaTopics, selectArchivedAcademiaTopics } from '../../lib/store'
import { TOPIC_BUCKET } from '../../data/academiaTopics'
import { useBackDismiss } from '../../lib/useBackDismiss'

function AcademiaRow({ item }) {
  const toggleDone = useStore((s) => s.toggleDone)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <Link
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      to={`/academia/${item.id}`}
      className={`item-row ${item.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <button
        className={`check ${item.status === 'done' ? 'on' : ''}`}
        onClick={(e) => { e.preventDefault(); toggleDone(item.id) }}
        aria-label={item.status === 'done' ? 'Mark not done' : 'Mark done'}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>
      <div className="item-title">{item.title}</div>
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
 * Academia: tabs across the top, same as every other list area — except the
 * tabs are user-editable topics (see data/academiaTopics.js) instead of a
 * fixed set of buckets from the area registry. A topic is a parent ITEM in
 * TOPIC_BUCKET and each entry is one of its sub-items, so add/rename/
 * reorder/delete all come from the machinery Projects and Fitness already
 * use — only the tab list itself is data instead of config.
 *
 * 'All' is a real tab, not a topic: it shows every entry regardless of
 * topic, including ones with no parentId (added before topics existed, or
 * quick-captured with no topic chosen) — nothing files into a topic by
 * itself, and 'All' is where an unfiled entry stays visible.
 */
export default function AcademiaList() {
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const archiveItem = useStore((s) => s.archiveItem)
  const restoreItem = useStore((s) => s.restoreItem)
  const reorderItems = useStore((s) => s.reorderItems)
  const seedAcademiaTopics = useStore((s) => s.seedAcademiaTopics)

  const [activeTab, setActiveTab] = useState('all')
  const [draft, setDraft] = useState('')
  const [newTopic, setNewTopic] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showArchivedTopics, setShowArchivedTopics] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const allItems = useStore(useShallow(selectAreaItems('academia', showArchived)))
  const topics = useStore(useShallow(selectAcademiaTopics))
  const archivedTopics = useStore(useShallow(selectArchivedAcademiaTopics))

  // A topic tab that got deleted/archived out from under the current
  // selection (elsewhere, or by another synced device) falls back to 'All'
  // rather than rendering a dangling tab.
  const activeTopic = activeTab !== 'all' ? topics.find((t) => t.id === activeTab) : null
  const tab = activeTab === 'all' || activeTopic ? activeTab : 'all'

  const items = useMemo(
    () => (tab === 'all' ? allItems.filter((i) => i.bucket !== TOPIC_BUCKET) : allItems.filter((i) => i.parentId === tab)),
    [allItems, tab],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = items.map((i) => i.id)
    reorderItems('academia', arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  const switchTab = (id) => {
    setActiveTab(id)
    setRenaming(false)
    setNewTopic(null)
  }

  const add = () => {
    if (!draft.trim()) return
    addItem('academia', draft, tab === 'all' ? {} : { parentId: tab })
    setDraft('')
  }

  const addTopic = () => {
    if (!newTopic?.trim()) return
    const created = addItem('academia', newTopic, { bucket: TOPIC_BUCKET })
    setNewTopic(null)
    switchTab(created.id)
  }

  const startRename = () => {
    setRenameValue(activeTopic.title)
    setRenaming(true)
  }
  const commitRename = () => {
    setRenaming(false)
    if (renameValue.trim() && renameValue !== activeTopic.title) updateItem(activeTopic.id, { title: renameValue.trim() })
  }

  useBackDismiss(() => setConfirmDelete(null), confirmDelete != null)

  return (
    <>
      <div className="page-head"><h1>Academia</h1></div>

      {topics.length === 0 && !showArchived ? (
        <section className="fin-section card">
          <h3>No topics yet</h3>
          <p className="wo-hint">
            Start with a few subjects worth learning about, then fill them with books, videos,
            podcasts — whatever you're working through. Rename or delete any of them later.
          </p>
          <div className="wo-entry">
            <button className="btn-primary" onClick={seedAcademiaTopics}>Add starter topics</button>
            <button className="btn-ghost" onClick={() => setNewTopic('')}>Start empty</button>
          </div>
          {newTopic != null && (
            <div className="fin-addrow">
              <input
                className="fin-title" autoFocus placeholder="Name a topic, e.g. Design"
                value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
              />
              <button className="fin-add" onClick={addTopic}>Add</button>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="bucket-tabs">
            <button className={`bucket-tab ${tab === 'all' ? 'on' : ''}`} onClick={() => switchTab('all')}>All</button>
            {topics.map((t) => (
              <button key={t.id} className={`bucket-tab ${tab === t.id ? 'on' : ''}`} onClick={() => switchTab(t.id)}>
                {t.title}
              </button>
            ))}
            <button className="bucket-tab" onClick={() => setNewTopic('')} aria-label="Add a topic">
              <Plus size={14} strokeWidth={2.25} />
            </button>
          </div>

          {newTopic != null && (
            <div className="fin-addrow st-newcat">
              <input
                className="fin-title" autoFocus placeholder="Name a topic, e.g. Design"
                value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
              />
              <button className="fin-add" onClick={addTopic}>Add</button>
              <button className="fin-add" onClick={() => setNewTopic(null)}>Cancel</button>
            </div>
          )}

          {activeTopic && (
            <div className="st-col-head">
              {renaming ? (
                <input
                  autoFocus className="st-rename" value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                />
              ) : (
                <button className="st-col-title" onClick={startRename}>{activeTopic.title}</button>
              )}
              {items.length === 0 && (
                <button
                  className="wo-info"
                  onClick={() => { archiveItem(activeTopic.id); switchTab('all') }}
                  aria-label={`Archive ${activeTopic.title}`}
                >
                  <Archive size={14} strokeWidth={1.75} />
                </button>
              )}
              <button className="wo-info" onClick={() => setConfirmDelete(activeTopic)} aria-label={`Delete ${activeTopic.title}`}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          {items.length === 0 && (
            <div className="empty-note">
              {showArchived ? 'No archived entries.' : 'Nothing here yet. Add one below.'}
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="item-list">
                {items.map((i) => <AcademiaRow key={i.id} item={i} />)}
              </div>
            </SortableContext>
          </DndContext>

          <div className="add-row">
            <input
              value={draft}
              placeholder={`Add to ${tab === 'all' ? 'Academia' : activeTopic?.title}…`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
          </div>
        </>
      )}

      {archivedTopics.length > 0 && (
        <button className="archived-toggle" onClick={() => setShowArchivedTopics(!showArchivedTopics)}>
          {showArchivedTopics ? 'Hide archived topics' : `${archivedTopics.length} archived topic${archivedTopics.length === 1 ? '' : 's'}`}
        </button>
      )}
      {showArchivedTopics && (
        <div className="link-chips">
          {archivedTopics.map((t) => (
            <button key={t.id} className="chip" onClick={() => restoreItem(t.id)}>{t.title} — restore</button>
          ))}
        </div>
      )}

      <button className="archived-toggle" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Back to active' : 'View archived'}
      </button>

      {confirmDelete && (
        <>
          <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="sheet" role="dialog" aria-label="Delete topic">
            <div className="sheet-grab" />
            <h2>Delete “{confirmDelete.title}”?</h2>
            <p className="wo-hint">
              {(() => {
                const n = allItems.filter((i) => i.parentId === confirmDelete.id).length
                if (n === 0) return 'The topic is empty, so nothing else goes with it.'
                return `Its ${n} ${n === 1 ? 'entry goes' : 'entries go'} with it. Move ${n === 1 ? 'it' : 'them'} first if you want to keep ${n === 1 ? 'it' : 'them'}.`
              })()}
            </p>
            <div className="sheet-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn-ghost btn-danger"
                onClick={() => { deleteItem(confirmDelete.id); setConfirmDelete(null); switchTab('all') }}
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
