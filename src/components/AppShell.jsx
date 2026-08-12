import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useStore } from '../lib/store'
import { useBackDismiss } from '../lib/useBackDismiss'
import { levelForPoints, levelProgress } from '../lib/rewards'
import { mainMenuEntries, pinnedEntries } from '../lib/sidebarOrder'
import AreaIcon from './AreaIcon'

const EDGE_PX = 24
const OPEN_THRESHOLD_PX = 60

/**
 * The sidebar is an off-canvas drawer on both breakpoints, opened by a
 * hamburger, closed by the backdrop, a swipe left, or tapping a destination.
 * Mobile shows a top bar with the hamburger, then Home and Areas (occupies
 * layout space instead of floating, so it can never sit on top of a page's
 * heading; sticky keeps it reachable once the page scrolls). Desktop instead shows a slim,
 * always-visible strip standing in for the collapsed sidebar — click it to
 * bring the full sidebar out as an overlay. BottomNav (rendered by App) is
 * mobile's other nav surface — the two are independent, not a toggle
 * between them.
 *
 * The sidebar is two sections: a fixed top block (the PINNED_IDS
 * destinations) and, below the rule, the main menu — the user's saved order
 * minus whatever the top block already pins, so nothing is listed twice.
 * Both come from sidebarOrder.js; the order is editable on the Settings page.
 */
export default function AppShell({ children }) {
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

  useBackDismiss(closeDrawer, drawerOpen)

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sheet-backdrop" onClick={closeDrawer} />}

      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="wordmark">Stoa</div>
        <nav className="side-nav side-top">
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
      <div className="sidebar-strip">
        <button className="strip-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu size={18} strokeWidth={1.75} />
        </button>
      </div>
      <div className="content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <NavLink to="/" end className="topbar-btn" onClick={closeDrawer} aria-label="Home">
            <AreaIcon name="House" size={20} />
          </NavLink>
          <NavLink to="/areas" className="topbar-btn" onClick={closeDrawer} aria-label="Areas">
            <AreaIcon name="LayoutGrid" size={20} />
          </NavLink>
        </div>
        {children}
      </div>
    </div>
  )
}
