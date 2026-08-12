import { NavLink } from 'react-router-dom'
import { orderedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

const SLOT_COUNT = 6

/**
 * Phone-only nav: the user's top 6 ranked sidebar entries, in ranked order.
 * Home is not pinned here — it and Areas already live in the topbar, so
 * Home only takes a slot if the user actually ranks it that high. Settings
 * never appears here regardless of its sidebar rank; reach it through the
 * drawer. Quick add lives on the dashboard only — a nav bar is for going
 * places.
 */
export default function BottomNav() {
  const entries = orderedEntries().slice(0, SLOT_COUNT)

  return (
    <nav className="bottom-nav">
      {entries.map((e) => (
        <NavLink key={e.id} to={e.route} end={e.route === '/'}>
          <AreaIcon name={e.icon} size={20} />{e.name}
        </NavLink>
      ))}
    </nav>
  )
}
