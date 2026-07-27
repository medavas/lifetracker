import { Link } from 'react-router-dom'
import { AREAS } from '../data/areas'
import { useStore } from '../lib/store'

export default function AreasGrid() {
  const items = useStore((s) => s.items)
  const notes = useStore((s) => s.notes)

  const countFor = (a) =>
    a.kind === 'journal'
      ? notes.filter((n) => n.areaId === 'journal' && !n.itemId).length
      : items.filter((i) => i.areaId === a.id && i.status === 'open').length

  return (
    <div className="page">
      <div className="page-head">
        <h1>Areas</h1>
      </div>
      <div className="area-grid">
        {AREAS.map((a) => (
          <Link
            key={a.id}
            to={a.kind === 'journal' ? '/journal' : a.kind === 'habits' ? '/habits' : `/area/${a.id}`}
          >
            <div className="card area-card" style={{ '--area-c1': a.grad[0] }}>
              <div className="a-icon" style={{ background: `linear-gradient(135deg, ${a.grad[0]}33, ${a.grad[1]}22)` }}>
                {a.icon}
              </div>
              <div>
                <div className="a-name">{a.name}</div>
                <div className="a-count">
                  {countFor(a)} {a.kind === 'journal' ? 'entries' : 'open'}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
