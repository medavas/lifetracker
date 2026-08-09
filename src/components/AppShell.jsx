import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { levelForPoints, levelProgress } from '../lib/rewards'
import { mainMenuEntries, pinnedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

const EDGE_PX = 24
const OPEN_THRESHOLD_PX = 60

/**
 * Desktop: fixed left sidebar, always visible (≥900px, CSS-controlled).
 * Mobile: the same sidebar becomes an off-canvas drawer, opened by the
 * hamburger button or an edge swipe-right, closed by the backdrop, a swipe
 * left, or tapping a destination. BottomNav (rendered by App) is mobile's
 * other nav surface — the two are independent, not a toggle between them.
 *
 * The hamburger rides in a mobile-only top bar that takes up layout space
 * rather than floating over the page, so it can never sit on top of a page's
 * heading; sticky keeps it reachable once the page scrolls.
 *
 * The sidebar is two sections: a fixed top block (Quick add, then the
 * PINNED_IDS destinations) and, below the rule, the main menu — the user's
 * saved order minus whatever the top block already pins, so nothing is
 * listed twice. Both come from sidebarOrder.js; the order is editable on the
 * Settings page.
 */
export default function AppShell({ onAdd, children }) {
  const points = useStore((s) => s.points)
  const level = levelForPoints(points)
  const progress = levelProgress(points)
  const pinned = pinnedEntries()
  const entries = mainMenuEntries()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const touchStart = useRef(null)

  useEffect(() => {
    const onTouchStart = (e) => {
      if (drawerOpen) return
      const t = e.touches[0]
      if (t.clientX <= EDGE_PX) touchStart.current = { x: t.clientX, y: t.clientY }
    }
    const onTouchMove = (e) => {
      if (!touchStart.current) return
      const t = e.touches[0]
      const dx = t.clientX - touchStart.current.x
      const dy = Math.abs(t.clientY - touchStart.current.y)
      if (dx > OPEN_THRESHOLD_PX && dx > dy) {
        setDrawerOpen(true)
        touchStart.current = null
      }
    }
    const onTouchEnd = () => { touchStart.current = null }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [drawerOpen])

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sheet-backdrop" onClick={closeDrawer} />}

      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="wordmark">Stoa</div>
        <nav className="side-nav side-top">
          <button className="side-add" onClick={() => { closeDrawer(); onAdd() }}>
            <Plus size={16} strokeWidth={2} />Quick add
          </button>
          {pinned.map((e) => (
            <NavLink key={e.id} to={e.route} end={e.route === '/'} onClick={closeDrawer}>
              <AreaIcon name={e.icon} size={17} />{e.name}
            </NavLink>
          ))}
        </nav>
        <nav className="side-nav side-main">
          {entries.map((e) => (
            <NavLink key={e.id} to={e.route} end={e.route === '/'} onClick={closeDrawer}>
              <AreaIcon name={e.icon} size={17} />{e.name}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-level">Level {level}</div>
          <div className="side-pts">{points} pts · {Math.round(progress * 100)}% to L{level + 1}</div>
          <div className="side-bar"><span style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </aside>
      <div className="content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
