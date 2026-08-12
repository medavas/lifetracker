import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../../lib/store'
import { onEnter, onTab } from '../../lib/outline'

const SWIPE_EDGE_PX = 32
const SWIPE_THRESHOLD_PX = 70

/**
 * One Academia entry: a title and a single open textbox, nothing else --
 * unlike ProjectDetail this has no bucket chips, sub-items, or notes feed,
 * by design (see the Academia CSS block for the "just a textbox" layout).
 * The textbox supports plain-text outline nesting (see lib/outline.js):
 * Enter continues a "- "/"1. "/"a. " marker, Tab/Shift+Tab reindent.
 *
 * Auto-save covers every exit path deliberately: onBlur while still on the
 * page, plus a save on unmount (via a ref so it always has the latest
 * keystroke) for the paths that don't blur first -- the system/hardware
 * back button and the swipe-to-dismiss gesture below both unmount this
 * component without ever taking focus away from the textarea.
 */
export default function AcademiaDetail() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const hydrated = useStore.persist.hasHydrated()

  const item = useStore((s) => {
    const found = s.items.find((i) => i.id === itemId && !i.deletedAt)
    return found && found.areaId === 'academia' ? found : undefined
  })
  const updateItem = useStore((s) => s.updateItem)

  const [title, setTitle] = useState(item?.title ?? '')
  const [details, setDetails] = useState(item?.details ?? '')

  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setDetails(item.details)
    }
  }, [item?.id])

  // Always holds the latest typed values so the unmount save below never
  // reads stale state from the render the effect was set up on.
  const latest = useRef({ title, details })
  latest.current = { title, details }

  useEffect(() => () => {
    if (item) updateItem(item.id, { title: latest.current.title.trim() || item.title, details: latest.current.details })
  }, [item?.id])

  const textareaRef = useRef(null)
  const pendingCursor = useRef(null)
  useLayoutEffect(() => {
    if (pendingCursor.current != null && textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pendingCursor.current
      pendingCursor.current = null
    }
  }, [details])

  const touchStart = useRef(null)
  const back = () => navigate('/academia')
  // AppShell also opens the main nav drawer on an edge swipe (its own
  // window-level touch listener, EDGE_PX=24) -- stopPropagation here keeps
  // that swipe from bubbling past this overlay, so dismissing Academia's
  // detail pane can't also crack open the sidebar underneath it.
  const onTouchStart = (e) => {
    const t = e.touches[0]
    if (t.clientX <= SWIPE_EDGE_PX) {
      touchStart.current = { x: t.clientX, y: t.clientY }
      e.stopPropagation()
    } else {
      touchStart.current = null
    }
  }
  const onTouchMove = (e) => {
    if (!touchStart.current) return
    e.stopPropagation()
    const t = e.touches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = Math.abs(t.clientY - touchStart.current.y)
    if (dx > SWIPE_THRESHOLD_PX && dx > dy) {
      touchStart.current = null
      back()
    }
  }
  const onTouchEnd = (e) => {
    if (touchStart.current) e.stopPropagation()
    touchStart.current = null
  }

  if (!item) {
    return (
      <>
        <div className="page-head">
          <button className="back-btn" onClick={back}><ChevronLeft size={16} strokeWidth={1.75} />Back</button>
        </div>
        <div className="empty-note">{hydrated ? 'This entry no longer exists.' : 'Loading…'}</div>
      </>
    )
  }

  const save = () => updateItem(item.id, { title: title.trim() || item.title, details })

  const handleKeyDown = (e) => {
    const ta = e.target
    if (ta.selectionStart !== ta.selectionEnd) return // let the browser handle an active selection
    if (e.key === 'Tab') {
      e.preventDefault()
      const res = onTab(details, ta.selectionStart, e.shiftKey)
      if (res) {
        pendingCursor.current = res.cursor
        setDetails(res.value)
      }
    } else if (e.key === 'Enter') {
      const res = onEnter(details, ta.selectionStart)
      if (res) {
        e.preventDefault()
        pendingCursor.current = res.cursor
        setDetails(res.value)
      }
    }
  }

  return (
    <div className="outline-page" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="page-head">
        <button className="back-btn" onClick={back}><ChevronLeft size={16} strokeWidth={1.75} />Back</button>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>

      <textarea
        ref={textareaRef}
        className="outline-textarea"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        placeholder={'Start writing…\n"- " for a bullet, "1. " or "a. " for a list — Tab / Shift+Tab to nest'}
      />
    </div>
  )
}
