# Fitness Top Priorities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Fitness a "Top Priorities" bucket whose items check off daily like a Habit instead of completing once like a task, and fix the daily-graph bug this exposes (a Fitness `complete` log fires once and never re-arms).

**Architecture:** The item's own `bucket` field becomes the source of truth for check-off-vs-complete behavior — no new ITEM field, no new area kind. One new optional area config field (`habitBucket`) names which bucket (if any) gets habit treatment; `AreaView` defaults its bucket tab to that value; `ItemList` renders a habit-style row for any item whose `bucket` matches it; `rewards.js` sums both log kinds per area instead of only `complete`.

**Tech Stack:** React 19, zustand + persist (IndexedDB via idb-keyval), react-router-dom, lucide-react, vitest (node environment).

Spec: [2026-08-05-fitness-top-priorities-design.md](../specs/2026-08-05-fitness-top-priorities-design.md)

## Global Constraints

- **No emoji, dingbats, or arrow glyphs anywhere in `src/`.** Enforced by `src/lib/__tests__/no-emoji.test.js`, which walks every `.js/.jsx/.css/.html` file outside `__tests__`, including comments.
- **Vitest environment is `node`.** No DOM, no `window`, no `localStorage`. Components using hooks are never rendered in tests — the convention (`src/components/__tests__/AreaIcon.test.js`) is to call a component as a plain function, which does not work for a hook-using row. `ItemList.jsx`/`SortableRow` gets no new unit tests; verify by manual browser check instead.
- **4 primitives, not 12 modules.** No new ITEM field, no new LOG kind, no new AREA kind. `item.type` is untouched and unused by this feature.
- **The fix must be additive, not a replacement.** A `complete` log still contributes to a band exactly as it does today; a `habit-check` log on the same area adds on top. Existing chart/grid data can only go up relative to today's baseline for any area, never down or sideways.
- **`buildBandIndex` in `src/lib/rewards.js` does not change.** It already indexes every `complete` and `habit-check` log by `${kind}|${areaId}` regardless of the area's `kind` field. Only the per-band switch in `countsForDate` is narrow today.
- **Regression bar: `src/lib/__tests__/chart.test.js` must pass unchanged.** It consumes `bandCounts`'s output shape, not its internals; that shape does not change.
- **`pnpm test` and `pnpm lint` must both be green before every commit.**
- Conventional commit messages, lowercase scope, e.g. `feat(fitness): ...`.
- Branch: `fitness-top-priorities` (already created; the spec commit `3f9a2bf` is on it).

---

### Task 1: `habitBucket` area config and the `rewards.js` fix

The actual bug and its fix, plus the area config that names which bucket gets the new behavior. These two belong in one task: the config field is meaningless without the rewards fix, and the rewards fix has nothing to point at without the config field.

**Files:**
- Modify: `src/data/areas.js` (fitness row)
- Modify: `src/lib/rewards.js:111-125` (`countsForDate`)
- Test: `src/data/__tests__/areas.test.js`
- Test: `src/lib/__tests__/rewards.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AREAS.find(a => a.id === 'fitness').habitBucket === 'Top Priorities'`; `AREAS.find(a => a.id === 'fitness').buckets` starts with `'Top Priorities'`; `countsForDate` (via `bandCounts`/`dailyActivity`/`dailyPresence`) sums `complete` and `habit-check` logs per area for every non-journal, non-habits-kind daily band.

- [ ] **Step 1: Write the failing tests**

In `src/data/__tests__/areas.test.js`, add a new `describe` block at the end of the file:

```js
describe('fitness top priorities', () => {
  it('names Top Priorities as the fitness habit bucket, listed first', () => {
    const fitness = AREAS.find((a) => a.id === 'fitness')
    expect(fitness.habitBucket).toBe('Top Priorities')
    expect(fitness.buckets[0]).toBe('Top Priorities')
  })

  it('leaves every other area without a habit bucket', () => {
    for (const a of AREAS) {
      if (a.id === 'fitness') continue
      expect(a.habitBucket).toBeUndefined()
    }
  })
})
```

In `src/lib/__tests__/rewards.test.js`, inside the existing `describe('bandCounts', ...)` block, add two cases (the `log` helper and `D` constant already exist in this file — see the surrounding tests for the exact pattern):

```js
  it('counts habit-checks into a non-habits-kind band (the top-priorities case)', () => {
    const logs = [
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
    ]
    expect(bandCounts(logs, [], D).fitness).toBe(2)
  })

  it('sums completes and habit-checks in the same area on the same day', () => {
    const logs = [
      log({ kind: 'complete', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
      log({ kind: 'habit-check', areaId: 'fitness', date: D }),
    ]
    expect(bandCounts(logs, [], D).fitness).toBe(3)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/data/__tests__/areas.test.js src/lib/__tests__/rewards.test.js`
Expected: FAIL — `habitBucket` is `undefined` for the first new `areas.test.js` case (not `'Top Priorities'`), and the two new `rewards.test.js` cases report `fitness: 0` / `fitness: 1` instead of `2` / `3` (today's code only ever reads `complete|fitness`).

- [ ] **Step 3: Write minimal implementation**

In `src/data/areas.js`, replace the `fitness` row:

```js
  {
    id: 'fitness', name: 'Fitness', icon: 'Dumbbell', kind: 'list',
    trim: 'y',
    daily: { order: 3, series: 4 },
    habitBucket: 'Top Priorities',
    keywords: ['workout', 'gym', 'run', 'lift', 'exercise', 'training'],
    buckets: ['Top Priorities', 'Routine', 'Goals', 'PRs'],
  },
```

Update the file's leading doc comment: after the paragraph describing `route` (ends with "...zero component changes."), add:

```
 * `habitBucket` names the one bucket (if any) whose items check off daily
 * like a Habit instead of completing once like a task — the item's own
 * `bucket` field is the source of truth, so moving an item into or out of
 * that bucket switches its behavior with it. Undefined for every area that
 * doesn't opt in. Only `fitness` does today.
```

In `src/lib/rewards.js`, replace the `else` branch of `countsForDate`:

```js
    } else {
      const complete = day ? day.get(`complete|${area.id}`) || 0 : 0
      const checks = day ? day.get(`habit-check|${area.id}`) || 0 : 0
      out[area.id] = complete + checks
    }
```

Update the function's doc comment (currently ends "...so a fifth daily area needs no change here.") by adding a line after it:

```
 * A non-habits-kind band (list/library) sums BOTH `complete` and
 * `habit-check` logs for its area: `complete` fires once per item on
 * completion; `habit-check` re-arms daily for any item filed under the
 * area's `habitBucket`, if it has one. This is what lets a bucket like
 * Fitness's "Top Priorities" repeat on the chart instead of contributing
 * exactly once, ever.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS, entire suite — including `chart.test.js` and `dailyActivity`/`dailyPresence` cases in `rewards.test.js`, none of which use `habit-check` against `fitness` or `diet` today, so the additive sum changes nothing for them.

- [ ] **Step 5: Commit**

```bash
git add src/data/areas.js src/lib/rewards.js src/data/__tests__/areas.test.js src/lib/__tests__/rewards.test.js
git commit -m "fix(fitness): sum habit-checks into non-habits daily bands"
```

---

### Task 2: `AreaView` defaults to the habit bucket when one exists

**Files:**
- Modify: `src/views/AreaView.jsx`

**Interfaces:**
- Consumes: `area.habitBucket` from Task 1.
- Produces: `AreaView` passes a `habitBucket` prop to `ItemList` (consumed by Task 3).

This task has no new automated test — it is a one-line state-initializer change with no pure logic to isolate, in a component that (per the codebase's own convention) is not rendered in tests. It is verified in Task 3's manual browser check, where opening Fitness landing on "Top Priorities" is one of the listed steps. Do not add a test file for this step in isolation.

- [ ] **Step 1: Make the change**

In `src/views/AreaView.jsx`, change the bucket state initializer (currently `useState('All')`) to:

```jsx
  const [bucket, setBucket] = useState(area?.habitBucket ?? 'All')
```

Note `area` is read via `areaById(areaId)` earlier in the component and can be `undefined` for an unknown `areaId` (the component already handles that with an early `if (!area) return ...` a few lines below the hooks) — the `area?.` guard keeps this line safe regardless of hook-ordering, since React hooks must run unconditionally before that early return.

Then, in the JSX, add the prop to the existing `<ItemList items={items} areaId={areaId} />` call:

```jsx
      <ItemList items={items} areaId={areaId} habitBucket={area.habitBucket} />
```

(By this point in the JSX the early-return for a missing `area` has already happened, so plain `area.habitBucket` is safe here — no `?.` needed.)

- [ ] **Step 2: Run the suite**

Run: `pnpm test`
Expected: PASS, entire suite — this file has no dedicated unit tests today (components with hooks aren't rendered in tests in this codebase), so this step is a regression check, not new coverage. `pnpm lint` should also be clean.

- [ ] **Step 3: Commit**

```bash
git add src/views/AreaView.jsx
git commit -m "feat(fitness): open an area on its habit bucket by default"
```

---

### Task 3: The habit-style row in `ItemList`

The one place that actually changes what you see and tap. No unit tests for this task, per the same hooks-in-tests convention — verified by the manual browser check in Step 3, which also proves Tasks 1 and 2 together.

**Files:**
- Modify: `src/components/ItemList.jsx`

**Interfaces:**
- Consumes: `habitBucket` prop from Task 2 (`AreaView`); `toggleHabitToday`, `logs` from `src/lib/store.js` (already exist, used by `src/views/Habits.jsx` — read that file for the reference pattern this task mirrors); `habitStreak`, `todayKey` from `src/lib/rewards.js` (already exist).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add the reactive habit state and the streak import**

In `src/components/ItemList.jsx`, add to the imports:

```jsx
import { Check, ChevronRight, Flame, GripVertical } from 'lucide-react'
import { useStore } from '../lib/store'
import { habitStreak, todayKey } from '../lib/rewards'
```

(`Flame` and the two `rewards.js` imports are new; `Check`, `ChevronRight`, `GripVertical`, and `useStore` already exist in the file — only add what's missing to the existing import lines.)

- [ ] **Step 2: Branch `SortableRow` on whether this item is in the habit bucket**

Replace the whole `SortableRow` function with:

```jsx
function SortableRow({ item, onOpen, habitBucket }) {
  const toggleDone = useStore((s) => s.toggleDone)
  const toggleHabitToday = useStore((s) => s.toggleHabitToday)
  const logs = useStore((s) => s.logs)
  const updateItem = useStore((s) => s.updateItem)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== item.title) updateItem(item.id, { title: draft.trim() })
    else setDraft(item.title)
  }

  const isPriority = habitBucket != null && item.bucket === habitBucket
  const checkedToday = isPriority
    ? logs.some(
        (l) => l.itemId === item.id && l.kind === 'habit-check' && l.date === todayKey() && !l.deletedAt,
      )
    : false
  const streak = isPriority ? habitStreak(logs, item.id) : 0

  return (
    <div
      ref={setNodeRef}
      className={`item-row ${item.status === 'done' ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {isPriority ? (
        <button
          className={`habit-check ${checkedToday ? 'on' : ''}`}
          onClick={() => toggleHabitToday(item.id)}
          aria-label={checkedToday ? `Uncheck ${item.title} for today` : `Check ${item.title} for today`}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      ) : (
        <button
          className={`check ${item.status === 'done' ? 'on' : ''}`}
          onClick={() => toggleDone(item.id)}
          aria-label={item.status === 'done' ? 'Mark not done' : 'Mark done'}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      )}
      <div className="item-title" onClick={() => !editing && setEditing(true)}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          item.title
        )}
      </div>
      {isPriority && (
        <div className="streak" aria-label={`${streak} day streak`}>
          <Flame size={13} strokeWidth={1.75} /><b>{streak}</b>
        </div>
      )}
      <button className="detail-btn" onClick={() => onOpen(item)} aria-label="Details">
        <ChevronRight size={17} strokeWidth={1.75} />
      </button>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}
```

Everything except the leading check button and the new streak badge is unchanged from the current row — title editing, the details button, and the drag handle are identical for both row kinds. The `check`/`habit-check` and `streak` CSS classes already exist in `src/App.css` (used by `Habits.jsx`); no new styles are needed.

- [ ] **Step 3: Thread the prop through `ItemList`**

In the same file, update the exported `ItemList` component's signature and its render of `SortableRow`:

```jsx
export default function ItemList({ items, areaId, habitBucket }) {
```

```jsx
              <SortableRow key={item.id} item={item} onOpen={setOpen} habitBucket={habitBucket} />
```

(Only these two lines change in `ItemList` itself — the drag sensors, `onDragEnd`, and the empty-state early return are untouched.)

- [ ] **Step 4: Run the suite**

Run: `pnpm test`
Expected: PASS, entire suite unchanged — `ItemList.jsx` has no existing unit tests to break (hooks-using components aren't rendered in tests here), and no other file's tests touch this component. `pnpm lint` should also be clean.

- [ ] **Step 5: Manual browser verification**

Run: `pnpm dev`, then in the browser:

1. Go to Areas → Fitness. It opens on the **Top Priorities** tab (proves Task 2).
2. Add an item, e.g. "Workout" (proves the add-row still works unchanged; it's filed into the currently-selected bucket, "Top Priorities").
3. The row shows a check button and a streak badge reading `0` (proves Task 3's row branch fires for this bucket).
4. Check it. The button fills in, the streak becomes `1`, and your points (visible on the dashboard) go up by 5 — the same reward a Keystone Habit check-in gives (proves `toggleHabitToday` is wired correctly and that points are area-agnostic, unchanged code).
5. Go to the dashboard (`/`). The "Last 7 days" stacked chart's fitness segment for today is non-zero, and the "Last 5 weeks" grid's today cell shows fitness present (proves Task 1's `rewards.js` fix end-to-end).
6. Uncheck the item. The streak returns to `0`, and both the chart and the grid drop fitness back to nothing for today (proves the reversal path — `toggleHabitToday`'s existing tombstone behavior — flows through unchanged).
7. Switch to the **Routine** tab and add a different item, e.g. "Stretch." It renders with the plain checkbox row, not the habit row (proves an item outside the habit bucket is unaffected).
8. Mark "Stretch" done via its checkbox. The dashboard's fitness segment bumps by one **and stays there after a page reload** even though the item is now `done` — a single, permanent bump, not a repeating one (proves the two row kinds coexist and additivity holds, per the spec's explicit non-goal of replacing the old behavior).

- [ ] **Step 6: Commit**

```bash
git add src/components/ItemList.jsx
git commit -m "feat(fitness): habit-style check-off row for the habit-bucket item"
```

---

## Self-review notes

**Spec coverage.** `habitBucket` area field and Fitness's updated bucket list (Task 1) · the `rewards.js` additive fix, the actual bug (Task 1) · `AreaView` defaulting to the habit bucket (Task 2) · `ItemList`'s bucket-driven row branch, streak badge, reactive check state (Task 3) · every listed test in the spec's Testing section (Tasks 1 and 3) · the regression bar on `chart.test.js` (Task 1, explicitly run) · every "explicitly out of scope" item in the spec (Dashboard's keystones, `item.type`, re-bucketing guards, cross-area generalization) — none of the three tasks touch any of them.

**No placeholders.** Every step has literal code, not a description of code.

**Type/name consistency checked across tasks:** `habitBucket` (area field, Task 1) → `habitBucket` prop (`AreaView` → `ItemList`, Task 2) → `habitBucket` prop (`ItemList` → `SortableRow`, Task 3) — same name throughout, no drift. `item.bucket === habitBucket` in Task 3 matches the exact field name (`bucket`) already used everywhere else in `ItemList.jsx`, `AreaView.jsx`, and `store.js`'s `addItem`.
