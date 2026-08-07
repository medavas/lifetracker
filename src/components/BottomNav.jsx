import { NavLink, Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { orderedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

/**
 * Phone-only nav: the user's top 4 sidebar entries flank a fixed center
 * button that always opens Journal directly (not Quick Add — Journal's own
 * compose box already does the fuzzy "file this elsewhere" trick Quick Add
 * does, so there's nothing to open a modal for). Settings never appears
 * here regardless of its sidebar rank; reach it through the drawer.
 */
export default function BottomNav() {
  const [first, second, third, fourth] = orderedEntries()

  const renderEntry = (e) =>
    e && (
      <NavLink key={e.id} to={e.route} end={e.route === '/'}>
        <AreaIcon name={e.icon} size={20} />{e.name}
      </NavLink>
    )

  return (
    <nav className="bottom-nav">
      {renderEntry(first)}
      {renderEntry(second)}
      <Link to="/journal" className="nav-add" aria-label="Journal">
        <Plus size={22} strokeWidth={2} />
      </Link>
      {renderEntry(third)}
      {renderEntry(fourth)}
    </nav>
  )
}
