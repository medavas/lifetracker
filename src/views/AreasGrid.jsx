import { Link } from 'react-router-dom'
import { AREAS, routeFor } from '../data/areas'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/rewards'
import AreaIcon from '../components/AreaIcon'

export default function AreasGrid() {
  const items = useStore((s) => s.items)
  const notes = useStore((s) => s.notes)
  const logs = useStore((s) => s.logs)

  const countFor = (a) =>
    a.kind === 'journal'
      ? notes.filter((n) => n.areaId === 'journal' && !n.itemId).length
      : a.kind === 'focus'
        ? logs.filter((l) => !l.deletedAt && l.areaId === 'focus' && l.kind === 'complete' && l.date === todayKey()).length
        : items.filter((i) => i.areaId === a.id && i.status === 'open' && !i.parentId).length

  return (
    <div className="page">
      <div className="page-head">
        <h1>Areas</h1>
      </div>
      <div className="area-grid">
        {AREAS.map((a) => (
          <Link
            key={a.id}
            to={routeFor(a)}
          >
            <div className="card area-card" style={{ '--area-c1': `var(--trim-${a.trim})` }}>
              <div className="a-icon"><AreaIcon name={a.icon} /></div>
              <div>
                <div className="a-name">{a.name}</div>
                <div className="a-count">
                  {countFor(a)} {a.kind === 'journal' ? 'entries' : a.kind === 'focus' ? 'today' : 'open'}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
