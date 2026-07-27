import { NavLink } from 'react-router-dom'

export default function BottomNav({ onAdd }) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="nav-ico">🏠</span>Home
      </NavLink>
      <NavLink to="/areas">
        <span className="nav-ico">🗂️</span>Areas
      </NavLink>
      <button className="nav-add" onClick={onAdd} aria-label="Quick add">
        +
      </button>
      <NavLink to="/habits">
        <span className="nav-ico">🔑</span>Habits
      </NavLink>
      <NavLink to="/journal">
        <span className="nav-ico">📓</span>Journal
      </NavLink>
    </nav>
  )
}
