# Projects Delinearized Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Projects into a master-detail container — a list of projects plus a per-project detail page with its own notes feed and a checklist of sub-tasks, whose completion the project's own status derives from.

**Architecture:** A sub-task is an ITEM carrying a new `parentId` field, one level of nesting only. Project completion is derived by a new store helper, `syncParentCompletion`, which recomputes the sub-task ratio and — only on a mismatch — calls the *existing* `toggleDone` to flip the project, reusing its points/log logic rather than duplicating it. One route tree (`/projects`, `/projects/:projectId`) serves both a side-by-side desktop layout and a one-pane-at-a-time mobile drill-down, switched entirely by CSS.

**Tech Stack:** React 19, react-router-dom, zustand + persist (IndexedDB via idb-keyval), @dnd-kit (already a dependency, used identically elsewhere for drag-reorder), lucide-react, vitest (node environment).

Spec: [2026-08-06-projects-delinearized-design.md](../specs/2026-08-06-projects-delinearized-design.md)

## Global Constraints

- **No emoji, dingbats, or arrow glyphs anywhere in `src/`.** Enforced by `src/lib/__tests__/no-emoji.test.js`, which walks every `.js/.jsx/.css/.html` file outside `__tests__`, comments included.
- **Vitest environment is `node`.** No DOM. Components using hooks are never rendered in tests — the convention (`src/components/__tests__/AreaIcon.test.js`) is to call a hook-free component as a plain function; a hook-using component gets no unit test at all, verified instead by a manual browser check.
- **4 primitives, not 12 modules.** `parentId` is the one deliberate concession this plan makes on ITEM — a sub-task is not a new primitive, and nesting stops at exactly one level (a sub-task cannot itself have sub-tasks).
- **Sub-tasks never earn points.** Only a project's own (derived) completion does, via the existing `toggleDone` path.
- **A project's derived completion only applies once it has at least one *live* sub-task** (not deleted, not archived). A project with none keeps today's plain, independently-toggleable checkbox.
- **Selecting a project is always a real navigation to `/projects/:projectId`, on both viewport widths — never local component state.** This is what makes the desktop detail pane bookmarkable/refresh-safe and lets one route tree serve both layouts.
- **`ItemSheet` is not used for projects.** `ProjectDetail` fully replaces it for this area; `ItemSheet` stays completely untouched for every other area.
- **`pnpm test` and `pnpm lint` must both be green before every commit.**
- Conventional commit messages, lowercase scope, e.g. `feat(projects): ...`.
- Branch: `projects-delinearized` (already created; the spec commit `e1b2223` is on it).

---

### Task 1: Store — `parentId`, derived completion, and the new selector/action

The foundation every view in this plan depends on. No UI yet.

**Files:**
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/store.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `addItem(areaId, title, { parentId, ... })` — attaches `parentId` conditionally, same pattern as `intervalMin`.
  - `toggleDone(id)` — unchanged for any item without a `parentId`; a sub-task's own toggle no longer writes a `complete` log or changes `points`.
  - `syncParentCompletion(parentId)` — new store action.
  - `reorderSubItems(parentId, orderedIds)` — new store action, mirrors `reorderItems`.
  - `selectSubItems(parentId) -> (state) -> Item[]` — new selector, mirrors `selectItemNotes`.
  - `archiveItem`, `restoreItem`, `deleteItem` — each now syncs the target's parent (if it has one) after acting; `deleteItem` additionally tombstones the deleted item's own sub-tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/store.test.js` (after the existing `describe('habit check-ins outside the Habits area', ...)` block). First, add `selectSubItems` to the top import:

```js
import { useStore, selectAreaItems, selectSubItems } from '../store.js'
```

Then append:

```js
describe('project sub-tasks', () => {
  beforeEach(reset)

  it('a project with no sub-tasks stays independently toggleable', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    useStore.getState().toggleDone(project.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('adding the first sub-task does not retroactively complete or reopen the project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('completing the last open sub-task completes the project and awards its points once', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
    useStore.getState().toggleDone(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('a sub-task toggle never changes points or writes a complete log on its own', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().points).toBe(0)
    expect(useStore.getState().logs.some((l) => l.kind === 'complete')).toBe(false)
    expect(useStore.getState().items.find((i) => i.id === a.id).status).toBe('done')
  })

  it('unchecking any sub-task on a completed project reopens it and reverts its points', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('adding a new open sub-task to an already-completed project reopens it', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
    expect(useStore.getState().points).toBe(0)
  })

  it('archiving the last incomplete sub-task completes the project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().toggleDone(a.id)
    useStore.getState().archiveItem(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    expect(useStore.getState().points).toBe(10)
  })

  it('restoring an archived incomplete sub-task reopens a completed project', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().archiveItem(b.id)
    useStore.getState().toggleDone(a.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('done')
    useStore.getState().restoreItem(b.id)
    expect(useStore.getState().items.find((i) => i.id === project.id).status).toBe('open')
  })

  it('deleting a project tombstones its sub-tasks', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    useStore.getState().deleteItem(project.id)
    expect(useStore.getState().items.find((i) => i.id === a.id).deletedAt).toBeTruthy()
  })

  it('leaves ordinary items free of parentId', () => {
    const it = useStore.getState().addItem('projects', 'ship it')
    expect('parentId' in it).toBe(false)
  })

  it('selectSubItems returns only that parent\'s live sub-tasks, sorted by order', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const other = useStore.getState().addItem('projects', 'Other project')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    useStore.getState().addItem('projects', 'Unrelated', { parentId: other.id })
    const subs = selectSubItems(project.id)(useStore.getState())
    expect(subs.map((i) => i.id)).toEqual([a.id, b.id])
  })

  it('reorderSubItems only touches its own parent\'s children', () => {
    const project = useStore.getState().addItem('projects', 'Redesign kitchen')
    const a = useStore.getState().addItem('projects', 'Pick paint', { parentId: project.id })
    const b = useStore.getState().addItem('projects', 'Order tile', { parentId: project.id })
    const unrelated = useStore.getState().addItem('projects', 'Unrelated top-level')
    const unrelatedOrderBefore = unrelated.order
    useStore.getState().reorderSubItems(project.id, [b.id, a.id])
    expect(useStore.getState().items.find((i) => i.id === a.id).order).toBe(1)
    expect(useStore.getState().items.find((i) => i.id === b.id).order).toBe(0)
    expect(useStore.getState().items.find((i) => i.id === unrelated.id).order).toBe(unrelatedOrderBefore)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/store.test.js`
Expected: FAIL — `parentId`, `syncParentCompletion`, `reorderSubItems`, and `selectSubItems` don't exist yet; several assertions about points/status will be wrong because sub-task toggles currently take the full points-awarding path.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/store.js`, update the leading doc comment's Item line:

```
 *  Item  - anything listed: task, habit, book, bill…   { id, areaId, bucket,
 *          title, details, type, status, order, createdAt, updatedAt,
 *          completedAt }
 *          Nudge timers additionally carry { intervalMin, enabled }.
 *          A project sub-task additionally carries { parentId }, one level
 *          of nesting only — a sub-task cannot itself have sub-tasks.
```

Replace `addItem` with:

```js
      addItem: (areaId, title, extra = {}) => {
        const items = get().items
        const order =
          Math.max(0, ...items.filter((i) => i.areaId === areaId).map((i) => i.order)) + 1
        const item = {
          id: uid(),
          areaId,
          bucket: extra.bucket ?? null,
          title: title.trim(),
          details: extra.details ?? '',
          type: extra.type ?? (areaId === 'habits' ? 'habit' : 'task'),
          status: 'open',
          order,
          createdAt: now(),
          updatedAt: now(),
          completedAt: null,
          deletedAt: null,
          // Nudge timers only. Attached conditionally so ordinary items don't
          // all carry two dead columns; merge.js passes the whole `data`
          // object through, so both fields sync with no sync-layer change.
          ...(extra.intervalMin != null && {
            intervalMin: extra.intervalMin,
            enabled: extra.enabled ?? false,
          }),
          // Project sub-tasks only. Same conditional-attachment pattern as
          // intervalMin above — absent everywhere else in the app.
          ...(extra.parentId != null && { parentId: extra.parentId }),
        }
        set({ items: [...items, item] })
        if (extra.parentId != null) get().syncParentCompletion(extra.parentId)
        return item
      },
```

Replace `toggleDone` with:

```js
      /**
       * Toggle done. For any item without a parentId (every item everywhere
       * else, including a project itself), this is unchanged: completing
       * awards points + a log, unchecking reverses them. A sub-task
       * (parentId set) takes a lighter path — its own status/completedAt
       * flips, but it never writes a complete log or changes points; only
       * the project's own derived completion, via syncParentCompletion
       * below, ever does that.
       */
      toggleDone: (id) => {
        const item = get().items.find((i) => i.id === id)
        if (!item) return

        if (item.parentId) {
          const flippedToDone = item.status !== 'done'
          set({
            items: get().items.map((i) =>
              i.id === id
                ? { ...i, status: flippedToDone ? 'done' : 'open', completedAt: flippedToDone ? now() : null, updatedAt: now() }
                : i,
            ),
          })
          get().syncParentCompletion(item.parentId)
          return
        }

        if (item.status === 'done') {
          const logs = get().logs.map((l) =>
            l.itemId === id && l.kind === 'complete' && l.date === todayKey() && !l.deletedAt
              ? { ...l, deletedAt: now(), updatedAt: now() }
              : l,
          )
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, status: 'open', completedAt: null, updatedAt: now() } : i,
            ),
            logs,
            points: computePoints(logs),
          })
        } else {
          const logs = [
            ...get().logs,
            { id: uid(), itemId: id, areaId: item.areaId, kind: 'complete', date: todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null },
          ]
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, status: 'done', completedAt: now(), updatedAt: now() } : i,
            ),
            logs,
            points: computePoints(logs),
          })
        }
      },

      /**
       * Recomputes a project's derived completion from its live (not
       * deleted, not archived) sub-tasks and, only if that disagrees with
       * its current status, flips it via the toggleDone above — reusing its
       * points-award/log-write/tombstone logic rather than duplicating it.
       * A project with zero live sub-tasks is untouched: it stays
       * independently toggleable exactly as before this feature existed.
       */
      syncParentCompletion: (parentId) => {
        if (!parentId) return
        const parent = get().items.find((i) => i.id === parentId && !i.deletedAt)
        if (!parent) return
        const subItems = get().items.filter(
          (i) => i.parentId === parentId && !i.deletedAt && i.status !== 'archived',
        )
        if (subItems.length === 0) return
        const allDone = subItems.every((i) => i.status === 'done')
        if (allDone && parent.status !== 'done') get().toggleDone(parentId)
        else if (!allDone && parent.status === 'done') get().toggleDone(parentId)
      },
```

Replace `archiveItem`, `restoreItem`, and `deleteItem` with:

```js
      /** Explicit archive/restore — separate from done. Each syncs the target's parent, if it has one. */
      archiveItem: (id) => {
        const item = get().items.find((i) => i.id === id)
        get().updateItem(id, { status: 'archived' })
        if (item?.parentId) get().syncParentCompletion(item.parentId)
      },
      restoreItem: (id) => {
        const item = get().items.find((i) => i.id === id)
        get().updateItem(id, { status: 'open' })
        if (item?.parentId) get().syncParentCompletion(item.parentId)
      },
      deleteItem: (id) => {
        const item = get().items.find((i) => i.id === id)
        const stamp = now()
        const logs = get().logs.map((l) => (l.itemId === id && !l.deletedAt ? { ...l, deletedAt: stamp, updatedAt: stamp } : l))
        set({
          items: get().items.map((i) =>
            i.id === id || i.parentId === id ? { ...i, deletedAt: stamp, updatedAt: stamp } : i,
          ),
          notes: get().notes.map((n) => (n.itemId === id && !n.deletedAt ? { ...n, deletedAt: stamp, updatedAt: stamp } : n)),
          logs,
          points: computePoints(logs),
        })
        if (item?.parentId) get().syncParentCompletion(item.parentId)
      },
```

Add `reorderSubItems` immediately after the existing `reorderItems`:

```js
      /** Sub-task drag-reorder, scoped by parentId instead of areaId — mirrors reorderItems exactly. */
      reorderSubItems: (parentId, orderedIds) =>
        set({
          items: get().items.map((i) =>
            i.parentId === parentId && orderedIds.includes(i.id)
              ? { ...i, order: orderedIds.indexOf(i.id), updatedAt: now() }
              : i,
          ),
        }),
```

Add `selectSubItems` immediately after the existing `selectItemNotes` in the selectors section:

```js
export const selectSubItems = (parentId) => (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.parentId === parentId && i.status !== 'archived')
    .sort((a, b) => a.order - b.order)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/store.test.js`
Expected: PASS, all tests including the 11 new ones.

Then run: `pnpm test`
Expected: PASS, whole suite — this confirms nothing outside this task's scope (every other area's `toggleDone`/`archiveItem`/`deleteItem` behavior) regressed, since none of those items ever have a `parentId`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.js src/lib/__tests__/store.test.js
git commit -m "feat(projects): parentId, derived project completion, sub-task reorder"
```

---

### Task 2: Area config, routing, and the Areas-grid count fix

Small and mechanical: gives Projects its own route and fixes the one place a raw item count would otherwise double-count sub-tasks.

**Files:**
- Modify: `src/data/areas.js`
- Modify: `src/data/__tests__/areas.test.js`
- Modify: `src/views/AreasGrid.jsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `routeFor(projectsArea) === '/projects'`, consumed by Task 5's routing and by any existing link to the Projects area (`AreasGrid`, `QuickAdd`, the sidebar).

- [ ] **Step 1: Write the failing tests**

In `src/data/__tests__/areas.test.js`, replace the `routing` describe block's first two tests:

```js
  it('routes the four non-generic areas to their own pages', () => {
    const routes = Object.fromEntries(AREAS.map((a) => [a.id, routeFor(a)]))
    expect(routes.journal).toBe('/journal')
    expect(routes.habits).toBe('/habits')
    expect(routes.nudges).toBe('/nudges')
    expect(routes.projects).toBe('/projects')
  })

  it('routes every other area through the generic area view', () => {
    for (const a of AREAS) {
      if (['journal', 'habits', 'nudges', 'projects'].includes(a.id)) continue
      expect(routeFor(a)).toBe(`/area/${a.id}`)
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/__tests__/areas.test.js`
Expected: FAIL — `routes.projects` is `undefined`, not `/projects`.

- [ ] **Step 3: Write minimal implementation**

In `src/data/areas.js`, change the `projects` row to add `route: '/projects'` on the same line as `trim`, matching the existing convention for `habits`/`journal`/`nudges`:

```js
  {
    id: 'projects', name: 'Projects', icon: 'Rocket', kind: 'list',
    trim: 'b', route: '/projects',
    keywords: ['project', 'build', 'ship', 'idea'],
    buckets: ['Active', 'Backlog', 'Someday'],
  },
```

In `src/views/AreasGrid.jsx`, change the `countFor` function's non-journal branch to exclude sub-tasks — `!i.parentId` is always true for every item outside Projects, so this is a no-op everywhere else and only changes Projects' count:

```js
  const countFor = (a) =>
    a.kind === 'journal'
      ? notes.filter((n) => n.areaId === 'journal' && !n.itemId).length
      : items.filter((i) => i.areaId === a.id && i.status === 'open' && !i.parentId).length
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js src/views/AreasGrid.jsx
git commit -m "feat(projects): dedicated route, exclude sub-tasks from the areas-grid count"
```

---

### Task 3: `ProjectDetail.jsx`

The detail pane: title, details, bucket, the sub-task checklist, the notes feed, archive/delete. No unit test — hooks-using component, matches this codebase's established convention. Verified in Task 5's manual browser check.

**Files:**
- Create: `src/views/projects/ProjectDetail.jsx`

**Interfaces:**
- Consumes: `selectItemNotes`, `selectSubItems`, `reorderSubItems` from Task 1; `areaById` from `src/data/areas.js`.
- Produces: nothing consumed by other tasks — wired into routing in Task 5. Does **not** render its own outer `.page` wrapper or `--area-c1` style; Task 5's `Projects.jsx` wrapper provides both, shared across both panes (matching how `Dashboard.jsx` wraps its own two-column content in exactly one outer `.page`).

- [ ] **Step 1: Create the component**

Create `src/views/projects/ProjectDetail.jsx`:

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Plus, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectItemNotes, selectSubItems } from '../../lib/store'
import { areaById } from '../../data/areas'

/** One row in a project's checklist: title, checkbox, drag handle only -- no notes, no further drill-down. */
function SortableSubTask({ item, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      className={`item-row ${item.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className={`check ${item.status === 'done' ? 'on' : ''}`}
        onClick={() => onToggle(item.id)}
        aria-label={item.status === 'done' ? 'Mark not done' : 'Mark done'}
      >
        <Check size={14} strokeWidth={2.5} />
      </button>
      <div className="item-title">{item.title}</div>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}

/**
 * A single project: title, details, bucket, its sub-task checklist, and
 * its notes feed. Fully replaces what ItemSheet gave a project -- ItemSheet
 * is not used here. A project with any live sub-task has no checkbox of
 * its own; completion is derived (see store.js's syncParentCompletion) and
 * only ever changes by finishing the sub-tasks.
 *
 * Title/details auto-save on blur rather than an explicit Save button --
 * a deliberate choice for a full page rather than a dismissable sheet.
 */
export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  // zustand's persist middleware hydrates from IndexedDB asynchronously, so
  // on first mount a real, existing project can briefly read as `undefined`
  // -- this distinguishes "still loading" from "genuinely gone" so a fresh
  // page load doesn't flash a false "no longer exists" message. Hydration
  // calls set() internally, which re-renders this component once it's
  // done, so no extra subscription is needed beyond reading this each render.
  const hydrated = useStore.persist.hasHydrated()

  const project = useStore((s) => s.items.find((i) => i.id === projectId && !i.deletedAt))
  const updateItem = useStore((s) => s.updateItem)
  const toggleDone = useStore((s) => s.toggleDone)
  const archiveItem = useStore((s) => s.archiveItem)
  const restoreItem = useStore((s) => s.restoreItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const addItem = useStore((s) => s.addItem)
  const reorderSubItems = useStore((s) => s.reorderSubItems)
  const addNote = useStore((s) => s.addNote)

  const notes = useStore(useShallow(selectItemNotes(projectId)))
  const subItems = useStore(useShallow(selectSubItems(projectId)))

  const [title, setTitle] = useState(project?.title ?? '')
  const [details, setDetails] = useState(project?.details ?? '')
  const [noteDraft, setNoteDraft] = useState('')
  const [subDraft, setSubDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  )

  if (!project) {
    return (
      <>
        <div className="page-head">
          <button className="back-btn" onClick={() => navigate('/projects')}>
            <ChevronLeft size={16} strokeWidth={1.75} />Back
          </button>
        </div>
        <div className="empty-note">{hydrated ? 'This project no longer exists.' : 'Loading…'}</div>
      </>
    )
  }

  const area = areaById(project.areaId)
  const archived = project.status === 'archived'

  const save = () => updateItem(projectId, { title: title.trim() || project.title, details })

  const addSubTask = () => {
    if (!subDraft.trim()) return
    addItem('projects', subDraft, { parentId: projectId })
    setSubDraft('')
  }

  const addProjectNote = () => {
    if (!noteDraft.trim()) return
    addNote(project.areaId, noteDraft, projectId)
    setNoteDraft('')
  }

  const onSubDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = subItems.map((i) => i.id)
    reorderSubItems(projectId, arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  return (
    <>
      <div className="page-head">
        <button className="back-btn" onClick={() => navigate('/projects')}>
          <ChevronLeft size={16} strokeWidth={1.75} />Back
        </button>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>

      <div className="field">
        <label>Details</label>
        <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} onBlur={save} placeholder="Notes, links, context…" />
      </div>

      <div className="field">
        <label>Bucket</label>
        <div className="link-chips">
          {area.buckets.map((b) => (
            <button
              key={b}
              className={`chip ${project.bucket === b ? 'on' : ''}`}
              onClick={() => updateItem(projectId, { bucket: project.bucket === b ? null : b })}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          {subItems.length > 0
            ? `Sub-tasks (${subItems.filter((i) => i.status === 'done').length}/${subItems.length})`
            : 'Sub-tasks'}
        </label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubDragEnd}>
          <SortableContext items={subItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="item-list">
              {subItems.map((item) => (
                <SortableSubTask key={item.id} item={item} onToggle={toggleDone} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="add-row">
          <input
            value={subDraft}
            placeholder="Add a sub-task…"
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubTask()}
          />
          <button onClick={addSubTask} aria-label="Add sub-task"><Plus size={20} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="field">
        <label>Notes ({notes.length})</label>
        {notes.map((n) => (
          <div key={n.id} className="card note-card">
            <div className="note-date">{new Date(n.createdAt).toLocaleString()}</div>
            <div className="note-text">{n.text}</div>
          </div>
        ))}
        <div className="add-row">
          <input
            value={noteDraft}
            placeholder="Add a note…"
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProjectNote()}
          />
          <button onClick={addProjectNote} aria-label="Add note"><Plus size={20} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="sheet-actions">
        {subItems.length === 0 && (
          <button
            className={`check ${project.status === 'done' ? 'on' : ''}`}
            onClick={() => toggleDone(projectId)}
            aria-label="Toggle project done"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
        )}
        {archived ? (
          <button className="btn-ghost" onClick={() => restoreItem(projectId)}>Restore</button>
        ) : (
          <button className="btn-ghost" onClick={() => archiveItem(projectId)}>Archive</button>
        )}
        <button
          className="btn-ghost btn-danger"
          onClick={() => {
            if (confirmDelete) { deleteItem(projectId); navigate('/projects') }
            else setConfirmDelete(true)
          }}
        >
          {confirmDelete ? 'Sure?' : 'Delete'}
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Run the suite**

Run: `pnpm test`
Expected: PASS, whole suite unchanged — this file has no test and nothing imports it yet, so this is a regression check confirming the new file doesn't break the build.

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/views/projects/ProjectDetail.jsx
git commit -m "feat(projects): project detail pane with checklist and notes"
```

---

### Task 4: `ProjectList.jsx`

The master list pane. No unit test, same convention as Task 3. Verified in Task 5's manual browser check.

**Files:**
- Create: `src/views/projects/ProjectList.jsx`

**Interfaces:**
- Consumes: `selectAreaItems` from `src/lib/store.js` (existing, unmodified); `areaById` from `src/data/areas.js`.
- Produces: nothing consumed by other tasks — wired into routing in Task 5. Does **not** render its own outer `.page` wrapper, matching Task 3's note.

- [ ] **Step 1: Create the component**

Create `src/views/projects/ProjectList.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../../lib/store'
import { areaById } from '../../data/areas'

/** One top-level project: a plain checkbox if it has no live sub-tasks, progress ("3/5") if it does. */
function ProjectRow({ project }) {
  const items = useStore((s) => s.items)
  const toggleDone = useStore((s) => s.toggleDone)
  const subItems = useMemo(
    () => items.filter((i) => i.parentId === project.id && !i.deletedAt && i.status !== 'archived'),
    [items, project.id],
  )
  const hasSubItems = subItems.length > 0
  const doneCount = subItems.filter((i) => i.status === 'done').length

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`item-row ${!hasSubItems && project.status === 'done' ? 'done' : ''}`}
    >
      {!hasSubItems ? (
        <button
          className={`check ${project.status === 'done' ? 'on' : ''}`}
          // preventDefault (not stopPropagation) is what react-router-dom's
          // Link checks before navigating -- the documented way to nest an
          // interactive element inside a Link without triggering it.
          onClick={(e) => { e.preventDefault(); toggleDone(project.id) }}
          aria-label={project.status === 'done' ? 'Mark not done' : 'Mark done'}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      ) : (
        <div className="project-progress">{doneCount}/{subItems.length}</div>
      )}
      <div className="item-title">{project.title}</div>
    </Link>
  )
}

/**
 * The list pane: bucket tabs plus every top-level project (no parentId).
 * Selecting one is always a real navigation to /projects/:id, never local
 * selection state -- see the design doc.
 */
export default function ProjectList() {
  const area = areaById('projects')
  const addItem = useStore((s) => s.addItem)
  const allItems = useStore(useShallow(selectAreaItems('projects')))
  const topLevel = useMemo(() => allItems.filter((i) => !i.parentId), [allItems])

  const [bucket, setBucket] = useState('All')
  const [draft, setDraft] = useState('')

  const projects = useMemo(
    () => (bucket === 'All' ? topLevel : topLevel.filter((i) => i.bucket === bucket)),
    [topLevel, bucket],
  )

  const add = () => {
    if (!draft.trim()) return
    addItem('projects', draft, { bucket: bucket === 'All' ? null : bucket })
    setDraft('')
  }

  return (
    <>
      <div className="page-head"><h1>Projects</h1></div>

      <div className="bucket-tabs">
        {['All', ...area.buckets].map((b) => (
          <button key={b} className={`bucket-tab ${bucket === b ? 'on' : ''}`} onClick={() => setBucket(b)}>
            {b}
          </button>
        ))}
      </div>

      {projects.length === 0 && <div className="empty-note">No projects yet. Add one below.</div>}

      <div className="item-list">
        {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
      </div>

      <div className="add-row">
        <input
          value={draft}
          placeholder={`Add to ${bucket === 'All' ? 'Projects' : bucket}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add"><Plus size={20} strokeWidth={2} /></button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Run the suite**

Run: `pnpm test`
Expected: PASS, whole suite unchanged.

Then run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/views/projects/ProjectList.jsx
git commit -m "feat(projects): top-level project list pane"
```

---

### Task 5: Wire it together — `Projects.jsx`, routes, CSS

The final task: the responsive wrapper composing Tasks 3 and 4, the two new routes, the CSS that switches the layout by breakpoint, and the end-to-end manual verification that proves the whole feature works together.

**Files:**
- Create: `src/views/Projects.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `ProjectList` (Task 4), `ProjectDetail` (Task 3).
- Produces: nothing — this is the last task in the plan.

- [ ] **Step 1: Create the wrapper**

Create `src/views/Projects.jsx`:

```jsx
import { useParams } from 'react-router-dom'
import ProjectList from './projects/ProjectList'
import ProjectDetail from './projects/ProjectDetail'

/**
 * One route tree serves both layouts. Desktop (>=900px, CSS): both panes
 * render side by side, mirroring Dashboard's existing two-column split.
 * Mobile: CSS shows only one at a time, driven by whether :projectId is
 * present in the URL. Selecting a project is always a real navigation, so
 * the same two components work unmodified at either width.
 */
export default function Projects() {
  const { projectId } = useParams()

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className={`projects-shell ${projectId ? 'has-detail' : ''}`}>
        <div className="projects-list-pane"><ProjectList /></div>
        <div className="projects-detail-pane">
          {projectId ? <ProjectDetail /> : <div className="empty-note">Select a project.</div>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the routes in `App.jsx`**

In `src/App.jsx`, add the import alongside the other view imports:

```js
import Projects from './views/Projects'
```

Add the two new routes. Both point at the same `Projects` element — it reads `:projectId` via `useParams()` internally, so no separate element is needed for the with-id case:

```jsx
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<Projects />} />
```

- [ ] **Step 3: Add the CSS**

Append to `src/App.css`:

```css
/* ── Projects (delinearized) ─────────────────────────────── */
.projects-list-pane { display: block; }
.projects-detail-pane { display: none; }
.projects-shell.has-detail .projects-list-pane { display: none; }
.projects-shell.has-detail .projects-detail-pane { display: block; }
.project-progress { font-size: 12px; font-weight: 600; color: var(--text-secondary); flex: none; }

@media (min-width: 900px) {
  .projects-shell { display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: start; }
  .projects-list-pane, .projects-detail-pane { display: block !important; }
}
```

- [ ] **Step 4: Run the whole suite**

Run: `pnpm test`
Expected: PASS, entire suite.

Then run: `pnpm lint`
Expected: clean.

Then run: `pnpm build`
Expected: clean build, no errors.

- [ ] **Step 5: Manual browser verification**

Run: `pnpm dev`, then in the browser at **desktop width (≥900px)**:

1. Go to Areas -> Projects, or use the sidebar. You land on `/projects`: the list pane on the left, "Select a project" on the right.
2. Add a project, e.g. "Redesign kitchen". It appears in the list with a plain checkbox, no progress badge.
3. Click it. The URL becomes `/projects/<id>`; the right pane populates with its title/details/bucket/empty checklist/empty notes fields, still with the list visible on the left.
4. Add a sub-task, e.g. "Pick paint". The checklist shows it; the project's own checkbox (bottom of the detail pane) is now gone, replaced by nothing there — check the list pane's row for this project: it now shows "0/1", not a checkbox.
5. Check the sub-task off. The list pane's badge updates to "1/1", and the project's status is `done` — confirm by reloading the page at `/projects/<id>` and observing the project row and checklist state persisted (IndexedDB), not just in-memory.
6. Add a second sub-task while the project is fully checked off. The project reopens: the list badge drops back to "1/2".
7. Add a note in the project's Notes field. Confirm it appears, timestamped.
8. Archive the project. Confirm the "Restore" button appears in its place. Restore it.
9. Reload directly on a deep link, e.g. navigate the browser to `/#/projects/<id>` directly (typed/pasted, not clicked). It renders correctly without needing to have navigated through the list first.
10. Go to Areas. Confirm the Projects card's count matches the number of top-level projects shown in the list (not inflated by sub-tasks).

Then switch to **mobile width (<900px)** (resize or use device emulation) and repeat the core path:

11. `/projects` shows only the list, full width, no detail pane visible.
12. Tap a project. The URL becomes `/projects/<id>`, and only the detail pane is visible now, full width, with a working Back button.
13. Tap Back. You return to the full-width list.

- [ ] **Step 6: Commit**

```bash
git add src/views/Projects.jsx src/App.jsx src/App.css
git commit -m "feat(projects): wire the master-detail layout into routing"
```

---

## Self-review notes

**Spec coverage.** `parentId` as the sole new field, nesting capped at one level, `type` not used to distinguish sub-tasks (Task 1) · derived completion via `syncParentCompletion` reusing `toggleDone` (Task 1, fully tested for every direction: add, toggle, archive, delete, restore, in combination) · sub-tasks never earn points (Task 1, explicitly tested) · `reorderSubItems`/`selectSubItems` mirroring the existing patterns (Task 1) · `deleteItem`'s cascade extended to sub-tasks (Task 1) · Projects' dedicated route (Task 2) · the Areas-grid count fix, generic rather than special-cased (Task 2) · `ItemSheet` untouched and unused for projects (Tasks 3-4, no import of it anywhere) · sub-tasks as simple rows with no notes or drill-down (Task 3) · one route tree, CSS-driven responsive layout, real navigation for selection rather than local state (Task 5) · the full manual verification path the spec's Testing section describes, at both viewport widths, including a deep-link reload and the reopens-on-new-sub-task case.

**No placeholders.** Every step has literal code.

**Type/name consistency checked across tasks:** `selectSubItems`, `reorderSubItems`, and `syncParentCompletion` (Task 1) are imported and called with the exact same names in Tasks 3-4. `parentId` is spelled identically everywhere it appears (store, both new views, both test files). The route paths `/projects` and `/projects/:projectId` match exactly between Task 2's `routeFor` expectation, Task 3/4's `navigate`/`Link` calls, and Task 5's route declarations.

**Two deliberate additions beyond the spec's literal text, both correctness fixes caught while writing this plan, not scope creep:**
1. `restoreItem` now also calls `syncParentCompletion` when the restored item has a `parentId`. The spec's stated call-site list was `addItem`, `toggleDone`, `archiveItem`, `deleteItem` — but un-archiving an incomplete sub-task can just as easily change a project's completion ratio as archiving one does, and omitting it would silently leave a completed project's status stale after a restore. Tested explicitly in Task 1.
2. `ProjectDetail`'s "not found" state distinguishes IndexedDB still hydrating from the project genuinely not existing, via `useStore.persist.hasHydrated()`. This is the app's first view that looks up a single entity by id directly from a route param against the store (every other per-item view receives its item as an already-resolved prop) — an async-hydration race that didn't exist anywhere else in this codebase for the spec to have anticipated.

**One CSS naming decision worth stating:** `ProjectRow`'s progress badge uses a new `.project-progress` class rather than the existing `.streak` class, even though both are "a small number in the corner of an item row." `.streak`'s actual styling (`display: flex`, `color`, `gap`) is scoped under `.habit-row .streak` in the stylesheet — reusing the bare class name outside that ancestor would silently render unstyled, the exact class of bug a prior branch's final review caught and fixed for the fitness-priorities feature. A small dedicated class avoids repeating it.
