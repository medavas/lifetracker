import { NavLink } from 'react-router-dom'
import { House, LayoutGrid, KeyRound, NotebookPen, Plus, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { levelForPoints, levelProgress } from '../lib/rewards'

/**
 * Desktop shell: fixed left sidebar (≥900px, CSS-controlled) + content column.
 * On mobile the sidebar is display:none and BottomNav (rendered by App) takes over.
 */
export default function AppShell({ onAdd, children }) {
  const points = useStore((s) => s.points)
  const level = levelForPoints(points)
  const progress = levelProgress(points)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">Stoa</div>
        <nav className="side-nav">
          <NavLink to="/" end><House size={17} strokeWidth={1.75} />Home</NavLink>
          <NavLink to="/areas"><LayoutGrid size={17} strokeWidth={1.75} />Areas</NavLink>
          <NavLink to="/habits"><KeyRound size={17} strokeWidth={1.75} />Habits</NavLink>
          <NavLink to="/journal"><NotebookPen size={17} strokeWidth={1.75} />Journal</NavLink>
          <NavLink to="/settings"><SettingsIcon size={17} strokeWidth={1.75} />Sync</NavLink>
        </nav>
        <button className="side-add" onClick={onAdd}>
          <Plus size={16} strokeWidth={2} />Quick add
        </button>
        <div className="side-foot">
          <div className="side-level">Level {level}</div>
          <div className="side-pts">{points} pts · {Math.round(progress * 100)}% to L{level + 1}</div>
          <div className="side-bar"><span style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  )
}
