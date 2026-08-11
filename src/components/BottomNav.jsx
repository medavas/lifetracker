import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { HOME_ENTRY, orderedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

/**
 * Phone-only nav: Home always leads and never moves, so the first tab is a
 * stable landmark regardless of sidebar reordering. The next 3 slots are
 * the user's top-ranked sidebar entries (Home excluded from that ranking
 * here since it's already pinned in slot one). Center button opens Quick
 * Add. Settings never appears here regardless of its sidebar rank; reach
 * it through the drawer.
 */
export default function BottomNav({ onAdd }) {
  const [second, third, fourth] = orderedEntries().filter((e) => e.id !== HOME_ENTRY.id)

  const renderEntry = (e) =>
    e && (
      <NavLink key={e.id} to={e.route} end={e.route === '/'}>
        <AreaIcon name={e.icon} size={20} />{e.name}
      </NavLink>
    )

  return (
    <nav className="bottom-nav">
      {renderEntry(HOME_ENTRY)}
      {renderEntry(second)}
      <button type="button" className="nav-add" onClick={onAdd} aria-label="Quick add">
        <Plus size={22} strokeWidth={2} />
      </button>
      {renderEntry(third)}
      {renderEntry(fourth)}
    </nav>
  )
}
