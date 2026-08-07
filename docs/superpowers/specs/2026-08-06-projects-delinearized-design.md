# Projects delinearized

Date: 2026-08-06

## Summary

Projects becomes a container, not a list row. Selecting a project opens a
dedicated page with its own notes feed and its own checklist of sub-tasks,
reached through a master-detail layout — a list of projects plus the
selected one's detail — instead of today's flat bucket-tabbed list with a
bottom-sheet.

## The one concession, flagged

A sub-task is not a new primitive. It is an ITEM like any other, carrying
one new optional field: **`parentId`**, pointing at its parent project's
id. This is the same shape NOTE's `itemId` already establishes — a link
from one entity to its owner — applied item-to-item for the first time in
this app. `parentId` is absent on every item everywhere else, attached
conditionally exactly like nudges' `intervalMin` or fitness's `habitBucket`
before it: invisible to code that doesn't know about it.

**Nesting stops at one level.** A sub-task cannot itself have sub-tasks —
this is a checklist under a project, not a general outliner. Confirmed
during brainstorming: sub-tasks are simple rows (title, checkbox,
drag-reorder), with no notes of their own and no further drill-down. All
real writing happens in the project's own notes feed.

`item.type` is not used to distinguish a sub-task from anything else —
`parentId`'s presence is the sole signal. Do not introduce a `'subtask'`
type value; it would be a second, redundant way to express the same fact.

## Completion is derived, not toggled

A project with at least one live (non-archived, non-deleted) sub-task loses
its own checkbox — the UI shows progress instead ("3/5"). It transitions to
`done` automatically the moment every sub-task is checked, and reopens
automatically the moment any of them isn't — including when a *new*,
unchecked sub-task is added to an already-finished project, which
immediately reopens it to reflect that. A project with zero live sub-tasks
keeps today's plain checkbox, completely unchanged.

**Sub-tasks never earn points.** Only the project's own (derived)
completion does, via the exact same points-award/log-write path a manual
completion already uses today — nothing new to build there, just reused
correctly.

### The mechanism

One new internal store action, `syncParentCompletion(parentId)`:

```js
syncParentCompletion: (parentId) => {
  if (!parentId) return
  const parent = get().items.find((i) => i.id === parentId && !i.deletedAt)
  if (!parent) return
  const subItems = get().items.filter(
    (i) => i.parentId === parentId && !i.deletedAt && i.status !== 'archived',
  )
  if (subItems.length === 0) return // no live sub-tasks -> parent stays independently toggleable
  const allDone = subItems.every((i) => i.status === 'done')
  if (allDone && parent.status !== 'done') get().toggleDone(parentId)
  else if (!allDone && parent.status === 'done') get().toggleDone(parentId)
},
```

It recomputes the derived state and, only if that disagrees with the
project's current status, calls the **existing** `toggleDone(parentId)` —
reusing its points-award/log-write/tombstone logic verbatim rather than
duplicating it. Called from four places whenever a sub-task's existence or
status could change the ratio: `addItem` (new sub-task added), `toggleDone`
(a sub-task's own check/uncheck), `archiveItem`, and `deleteItem`.

**`toggleDone` gets one new fork, at the top, for items that are sub-tasks**
(`item.parentId` is set): flip `status`/`completedAt` with no log write and
no points change, then call `syncParentCompletion(item.parentId)`. Every
item without a `parentId` — meaning every item everywhere else in the app,
plus the projects themselves — takes the exact existing path, byte for
byte, followed by nothing extra. The recursion this implies (a sub-task's
toggle calls `syncParentCompletion`, which calls `toggleDone` on the
project, which is itself parent-less and so takes the plain existing path)
terminates in one hop, by construction, because nesting stops at one level.

`archiveItem` and `deleteItem` each look up the target's `parentId` before
acting and call `syncParentCompletion` afterward if it had one — covers
"the last incomplete sub-task got archived/deleted, so the rest are now
100%."

**`deleteItem`'s existing tombstone cascade gains one more filter.** It
already tombstones a deleted item's NOTEs; it now also tombstones items
whose `parentId` equals the deleted id — deleting a project takes its
sub-tasks with it, the same pattern as its notes, no new mechanism.

### What does not need to change, and why

`addItem`'s per-area `order` computation (`max(order among all items in
this areaId) + 1`) needs no `parentId`-awareness. Every read path
(`selectAreaItems`, the new `selectSubItems` below) filters to one group —
top-level items, or one specific parent's children — before sorting by
`order`. A shared, ever-increasing counter across groups still produces
correct relative order *within* any filtered subset; it only leaves gaps in
the raw numbers, exactly as bucket-filtered views already do today with the
existing per-area counter. Checked by hand, not assumed.

`reorderItems(areaId, orderedIds)` needs no change either: it only ever
touches items whose id appears in `orderedIds`, which — because
`ProjectList` only drags the top-level projects it displays — never
includes a sub-task's id. A new, separate `reorderSubItems(parentId,
orderedIds)` action handles the checklist's own drag-reorder, scoped by
`parentId` instead of `areaId`, mirroring `reorderItems`'s shape exactly.

## New selector

```js
export const selectSubItems = (parentId) => (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.parentId === parentId && i.status !== 'archived')
    .sort((a, b) => a.order - b.order)
```

Mirrors `selectItemNotes`'s and `selectAreaItems`'s existing shape.

## Layout — one route tree, CSS switches the shape

Two new routes, `/projects` and `/projects/:projectId`, replacing Projects'
fallback to the generic `/area/:id` view — the same pattern Journal,
Habits, and Nudges already use via their own `route` field in
`areas.js`. Both panes always render in the DOM; CSS decides what's
visible, matching the app's existing responsive convention (one route
tree, breakpoint-driven layout) rather than separate mobile/desktop routes:

- **Desktop (≥900px):** side-by-side, mirroring the dashboard's existing
  `.dash-grid` two-column split. `/projects` alone shows the list with an
  empty "Select a project" state on the right; `/projects/:projectId`
  populates it.
- **Mobile:** one pane at a time. `/projects` is the full-screen list;
  tapping a project navigates to `/projects/:projectId`, a full-screen
  detail page with a back button to `/projects` — the same drill-down shape
  Journal's day-list already uses for its own day-detail.

Selecting a project is always a real navigation to `/projects/:projectId`,
on both viewport widths — never local component state for "which project is
selected." This is what makes the desktop detail pane bookmarkable and
refresh-safe, and it's the only way the same two components can serve both
layouts from one route tree. The back button (mobile) and the list-item
links (both widths) navigate to an explicit path, not `navigate(-1)` —
the same reasoning Journal's back-buttons already established: correct on a
fresh deep link or reload, not just when arrived at by clicking through.

The list pane keeps the existing bucket tabs (Active/Backlog/Someday) for
filtering, exactly as today — unchanged, just relocated into the new list
pane's header. The list itself is filtered to top-level items only:
`selectAreaItems('projects')`'s result, further filtered to `!i.parentId`,
in the view — no store change needed for this read, since `parentId` is
absent on every non-sub-task item and the filter is a one-line addition at
the call site.

**`ItemSheet` is not used for projects.** `ProjectDetail` fully replaces
what it gave a project (title, details, bucket, notes) and adds the
checklist; clicking a project in `ProjectList` navigates to
`/projects/:projectId`, it does not open the bottom sheet. `ItemSheet`
stays exactly as it is for every other area — completely untouched.

`ProjectDetail` keeps parity with what `ItemSheet` offered: archive and
delete actions, in addition to title/details/bucket/notes and the new
checklist.

## AreasGrid's open count

`AreasGrid.jsx`'s per-area "N open" count is generic across every area
(`items.filter(i => i.areaId === a.id && i.status === 'open')`). Without a
change, it would include Projects' sub-tasks alongside its top-level
projects, inflating that one card's count relative to what the delinearized
list actually shows. The fix is one added clause, applied generically to
every area rather than special-cased for Projects — `!i.parentId` is always
true for every item outside Projects, so this is a no-op everywhere else:

```js
items.filter((i) => i.areaId === a.id && i.status === 'open' && !i.parentId).length
```

## Files

New:
- `src/views/Projects.jsx` — the responsive wrapper composing the two panes.
- `src/views/projects/ProjectList.jsx` — the master list pane (bucket tabs + top-level project rows + add-row).
- `src/views/projects/ProjectDetail.jsx` — title/details/bucket/notes/archive/delete, plus the sub-task checklist and its own add-row.

Modified:
- `src/lib/store.js` — `parentId` on `addItem`; the `toggleDone` fork;
  `syncParentCompletion`; the `deleteItem` cascade addition;
  `reorderSubItems`; the `selectSubItems` selector.
- `src/data/areas.js` — Projects' `route: '/projects'`.
- `src/views/AreasGrid.jsx` — the one-clause open-count fix above.
- `src/App.jsx` — the two new routes.

## Testing

The completion cascade is exactly the kind of multi-directional interaction
— add, toggle, archive, delete, in any order, from either the sub-task or
project side — worth real unit tests in `store.test.js`: a project with no
sub-tasks stays independently toggleable; adding the first sub-task doesn't
retroactively complete or reopen a project with no others; checking the
last open sub-task completes the project and awards its points exactly
once; unchecking any sub-task on a completed project reopens it and reverts
those points; a sub-task's own toggle never changes `points` on its own;
archiving or deleting the last incomplete sub-task completes the project;
deleting a project tombstones its sub-tasks.

The two new views get no unit tests, matching this codebase's established
convention that hook-using components are not rendered in tests. Verified
instead by a manual browser check: default landing on `/projects` at both
viewport widths, selecting a project populates the detail pane (desktop) or
navigates full-screen (mobile), adding a sub-task and checking it off,
watching a project auto-complete on the last one and auto-reopen on adding
a new one, archiving/deleting a project takes its sub-tasks with it, and
the Areas grid's Projects count matches the list's actual top-level count.

## Explicitly out of scope

- Sub-tasks having their own notes or any further drill-down — confirmed
  during brainstorming as a real fork, decided against.
- Nesting beyond one level.
- Any change to `ItemSheet`, `ItemList`, or how any other area behaves.
- A manual override of a project's derived completion — there is no way to
  force a project with live sub-tasks into `done` except finishing them.
