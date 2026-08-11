import { NavLink } from 'react-router-dom'
import { HOME_ENTRY, orderedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

/**
 * Phone-only nav: Home always leads and never moves, so the first tab is a
 * stable landmark regardless of sidebar reordering. The remaining slots are
 * the user's top-ranked sidebar entries (Home excluded from that ranking
 * here since it's already pinned in slot one). Settings never appears here
 * regardless of its sidebar rank; reach it through the drawer. Quick add
 * lives on the dashboard only — a nav bar is for going places.
 */
export default function BottomNav() {
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
      {renderEntry(third)}
      {renderEntry(fourth)}
    </nav>
  )
}
