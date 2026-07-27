import { NavLink } from 'react-router-dom'
import { House, LayoutGrid, KeyRound, NotebookPen, Plus } from 'lucide-react'

export default function BottomNav({ onAdd }) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <House size={20} strokeWidth={1.75} />Home
      </NavLink>
      <NavLink to="/areas">
        <LayoutGrid size={20} strokeWidth={1.75} />Areas
      </NavLink>
      <button className="nav-add" onClick={onAdd} aria-label="Quick add">
        <Plus size={22} strokeWidth={2} />
      </button>
      <NavLink to="/habits">
        <KeyRound size={20} strokeWidth={1.75} />Habits
      </NavLink>
      <NavLink to="/journal">
        <NotebookPen size={20} strokeWidth={1.75} />Journal
      </NavLink>
    </nav>
  )
}
