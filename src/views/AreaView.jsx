import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { areaById } from '../data/areas'
import ItemList from '../components/ItemList'
import AreaIcon from '../components/AreaIcon'

/** One generic view renders every 'list' and 'library' area. */
export default function AreaView() {
  const { areaId } = useParams()
  const navigate = useNavigate()
  const area = areaById(areaId)

  const [bucket, setBucket] = useState(area?.habitBucket ?? 'All')
  const [showArchived, setShowArchived] = useState(false)
  const [draft, setDraft] = useState('')

  const addItem = useStore((s) => s.addItem)
  const allItems = useStore(useShallow(selectAreaItems(areaId, showArchived)))

  const items = useMemo(
    () => (bucket === 'All' ? allItems : allItems.filter((i) => i.bucket === bucket)),
    [allItems, bucket],
  )

  if (!area) return <div className="page">Unknown area.</div>

  const add = () => {
    if (!draft.trim()) return
    addItem(areaId, draft, { bucket: bucket === 'All' ? null : bucket })
    setDraft('')
  }

  return (
    <div
      className="page"
      style={{ '--area-c1': `var(--trim-${area.trim})` }}
    >
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={16} strokeWidth={1.75} />Back</button>
        <div className="icon-chip"><AreaIcon name={area.icon} /></div>
        <h1>{area.name}</h1>
      </div>

      {area.buckets.length > 0 && (
        <div className="bucket-tabs">
          {['All', ...area.buckets].map((b) => (
            <button key={b} className={`bucket-tab ${bucket === b ? 'on' : ''}`} onClick={() => setBucket(b)}>
              {b}
            </button>
          ))}
        </div>
      )}

      <ItemList items={items} areaId={areaId} habitBucket={area.habitBucket} />

      <div className="add-row">
        <input
          value={draft}
          placeholder={`Add to ${bucket === 'All' ? area.name : bucket}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>

      <button className="archived-toggle" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Back to active' : 'View archived'}
      </button>
    </div>
  )
}
