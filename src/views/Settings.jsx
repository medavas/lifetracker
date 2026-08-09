import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { getSyncToken, setSyncToken, syncNow, useSyncStatus } from '../lib/sync'
import { orderableEntries, readSidebarOrder, writeSidebarOrder } from '../lib/sidebarOrder'
import AreaIcon from '../components/AreaIcon'

function SortableEntry({ entry }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id })

  return (
    <div
      ref={setNodeRef}
      className={`item-row ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <AreaIcon name={entry.icon} size={17} />
      <div className="item-title">{entry.name}</div>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}

/** Sidebar order: a device-local preference, editable by drag, driving both the desktop sidebar and phone's bottom-bar top-4. */
function SidebarOrderSection() {
  const [order, setOrder] = useState(() => readSidebarOrder())
  const byId = new Map(orderableEntries().map((e) => [e.id, e]))
  const entries = order.map((id) => byId.get(id)).filter(Boolean)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(active.id), order.indexOf(over.id))
    setOrder(next)
    writeSidebarOrder(next)
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 28 }}>Sidebar order</div>
      <p className="hint" style={{ marginBottom: 10 }}>
        Drag to reorder. The top 4 become your bottom-bar buttons on phone; the rest live in the
        side menu, below its pinned top section (Quick add, Nudges, Home, Settings, Areas).
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="item-list">
            {entries.map((entry) => <SortableEntry key={entry.id} entry={entry} />)}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
}

export default function Settings() {
  const [token, setToken] = useState(getSyncToken() || '')
  const status = useSyncStatus()

  const save = () => {
    setSyncToken(token.trim())
    syncNow()
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Sync</h1></div>
      <p>Paste your private sync token to link this device.</p>
      <div className="settings-field">
        <label htmlFor="sync-token">Sync token</label>
        <input
          id="sync-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="sync token"
        />
      </div>
      <button className="btn-primary" onClick={save}>Save & sync</button>
      {status.error && <p className="status-error">{status.error}</p>}
      {status.lastSyncedAt && !status.error && (
        <p className="status-ok">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString()}</p>
      )}

      <SidebarOrderSection />
    </div>
  )
}
