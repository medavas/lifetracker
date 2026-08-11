/**
 * Central store — the 4-primitive schema.
 *
 *  Area  - static config (src/data/areas.js), not stored.
 *  Item  - anything listed: task, habit, book, bill…   { id, areaId, bucket,
 *          title, details, type, status, order, createdAt, updatedAt,
 *          completedAt }
 *          Nudge timers additionally carry { intervalMin, enabled }.
 *          A finance spending category additionally carries { color }, its
 *          --series-* slot (1..8), stored so it never shifts under the user.
 *          A project sub-task additionally carries { parentId }, one level
 *          of nesting only — a sub-task cannot itself have sub-tasks.
 *  Log   - a dated record: habit check-ins, completions { id, itemId, areaId,
 *          kind, date, createdAt }
 *          Money logs additionally carry { amount, note?, prevDue? }.
 *          Workout set logs (kind 'set') additionally carry
 *          { exercise, weight, reps } — `exercise` is a static-config id
 *          from data/workoutProgram.js, so itemId stays null.
 *  Note  - journal entries, per-item notes, quotes      { id, areaId, itemId?,
 *          text, createdAt, updatedAt }
 *
 * status: 'open' | 'done' | 'archived'  — archive is EXPLICIT, never implied
 * by unchecking. Unchecking just returns an item to 'open'.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from './storage'
import { todayKey, computePoints } from './rewards'
import { toEntities, fromEntities, merge } from './merge'
import { advanceDue, nextCategoryColor, SPEND_SERIES } from './finance'
import { DEFAULT_PROGRAM, SESSION_BUCKET } from '../data/workoutProgram'
import { DEFAULT_STRETCH_CATEGORIES, STRETCH_BUCKET } from '../data/stretches'

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost) —
// fall back to a manual v4 UUID so a plain-HTTP tunnel URL doesn't throw on
// every add and take down the whole app.
const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
const now = () => Date.now()

export const useStore = create(
  persist(
    (set, get) => ({
      items: [],
      logs: [],
      notes: [],
      points: 0,

      // ── Items ────────────────────────────────────────────────
      addItem: (areaId, title, extra = {}) => {
        const items = get().items
        const order =
          Math.max(0, ...items.filter((i) => i.areaId === areaId).map((i) => i.order)) + 1
        // Structural one-level-nesting cap: a parentId is only honored when
        // its target itself has no parentId. Without this, a future call
        // site (or a stray URL — see ProjectDetail's own view-level guard)
        // could attach a sub-task to another sub-task, producing a
        // grandchild — the one architectural constraint this feature names.
        const targetParent =
          extra.parentId != null ? get().items.find((i) => i.id === extra.parentId) : null
        const parentId = targetParent && !targetParent.parentId ? extra.parentId : undefined
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
          // Finance items only (money area kind). Same conditional-attachment
          // pattern as intervalMin — bills carry all three, categories/goals
          // just amount; merge.js syncs them with no sync-layer change.
          ...(extra.amount != null && { amount: extra.amount }),
          ...(extra.cadence != null && { cadence: extra.cadence }),
          ...(extra.nextDue != null && { nextDue: extra.nextDue }),
          // Spending categories only: the palette slot the category is drawn
          // in everywhere. Assigned here rather than derived at render time
          // so it survives archiving a sibling — see lib/finance.js.
          ...(areaId === 'finance' && extra.bucket === 'Spending' && {
            color: extra.color ?? nextCategoryColor(items),
          }),
          // Project sub-tasks only. Same conditional-attachment pattern as
          // intervalMin above — absent everywhere else in the app.
          ...(parentId != null && { parentId }),
          // Workout program only. A session item carries `weekday`; an
          // exercise sub-item carries its target sets and rep range. Same
          // conditional-attachment pattern again, so no other area pays for
          // them and merge.js syncs them with no sync-layer change.
          ...(extra.weekday != null && { weekday: extra.weekday }),
          ...(extra.sets != null && { sets: extra.sets }),
          ...(extra.low != null && { low: extra.low }),
          ...(extra.high != null && { high: extra.high }),
          ...(extra.step != null && { step: extra.step }),
        }
        set({ items: [...items, item] })
        if (parentId != null) get().syncParentCompletion(parentId)
        return item
      },

      updateItem: (id, patch) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: now() } : i,
          ),
        }),

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
       * An archived project is frozen out of the cascade entirely — archive
       * is an explicit user action, never implied by a sub-task changing
       * underneath it (see the file-level invariant at the top).
       */
      syncParentCompletion: (parentId) => {
        if (!parentId) return
        const parent = get().items.find((i) => i.id === parentId && !i.deletedAt)
        if (!parent || parent.status === 'archived') return
        const subItems = get().items.filter(
          (i) => i.parentId === parentId && !i.deletedAt && i.status !== 'archived',
        )
        if (subItems.length === 0) return
        const allDone = subItems.every((i) => i.status === 'done')
        if (allDone && parent.status !== 'done') get().toggleDone(parentId)
        else if (!allDone && parent.status === 'done') get().toggleDone(parentId)
      },

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
        // The item may itself be a parent (a project) — re-derive its
        // status from its own live sub-tasks too, so restoring a project
        // whose sub-tasks were already all done comes back as 'done'
        // rather than stranding it at 'open' with no live checkbox. This is
        // a direct status patch rather than routing through
        // syncParentCompletion/toggleDone: archiveItem never tombstones
        // whatever `complete` log the project earned the first time it
        // finished, so replaying toggleDone's completion path here would
        // push a second live log for the same completion and double the
        // points it already banked.
        const subItems = get().items.filter(
          (i) => i.parentId === id && !i.deletedAt && i.status !== 'archived',
        )
        if (subItems.length > 0 && subItems.every((i) => i.status === 'done')) {
          get().updateItem(id, { status: 'done', completedAt: now() })
        }
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

      reorderItems: (areaId, orderedIds) =>
        set({
          items: get().items.map((i) =>
            i.areaId === areaId && orderedIds.includes(i.id)
              ? { ...i, order: orderedIds.indexOf(i.id), updatedAt: now() }
              : i,
          ),
        }),

      /** Sub-task drag-reorder, scoped by parentId instead of areaId — mirrors reorderItems exactly. */
      reorderSubItems: (parentId, orderedIds) =>
        set({
          items: get().items.map((i) =>
            i.parentId === parentId && orderedIds.includes(i.id)
              ? { ...i, order: orderedIds.indexOf(i.id), updatedAt: now() }
              : i,
          ),
        }),

      /**
       * Move a sub-item to a different parent and place it in that parent's
       * order — one atomic set(), because doing it as updateItem +
       * reorderSubItems would land the item in the new parent for a render
       * with a stale order and make it visibly jump.
       *
       * Both parents are re-synced afterwards: the item leaving one and
       * joining the other can change either side's derived completion, and
       * skipping that is exactly how a project ends up stuck 'done' with an
       * open sub-task under it.
       */
      moveSubItem: (id, newParentId, orderedIds) => {
        const item = get().items.find((i) => i.id === id)
        if (!item) return
        const oldParentId = item.parentId
        set({
          items: get().items.map((i) => {
            if (i.id === id) {
              return { ...i, parentId: newParentId, order: orderedIds.indexOf(id), updatedAt: now() }
            }
            if (i.parentId === newParentId && orderedIds.includes(i.id)) {
              return { ...i, order: orderedIds.indexOf(i.id), updatedAt: now() }
            }
            return i
          }),
        })
        if (oldParentId && oldParentId !== newParentId) get().syncParentCompletion(oldParentId)
        get().syncParentCompletion(newParentId)
      },

      // ── Habit check-ins ──────────────────────────────────────
      toggleHabitToday: (itemId) => {
        const { logs, items } = get()
        const date = todayKey()
        const existing = logs.find(
          (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === date && !l.deletedAt,
        )
        if (existing) {
          const next = logs.map((l) => (l.id === existing.id ? { ...l, deletedAt: now(), updatedAt: now() } : l))
          set({ logs: next, points: computePoints(next) })
        } else {
          const item = items.find((i) => i.id === itemId)
          const next = [
            ...logs,
            { id: uid(), itemId, areaId: item?.areaId ?? 'habits', kind: 'habit-check', date, createdAt: now(), updatedAt: now(), deletedAt: null },
          ]
          set({ logs: next, points: computePoints(next) })
        }
      },

      isHabitCheckedToday: (itemId) =>
        get().logs.some(
          (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === todayKey() && !l.deletedAt,
        ),

      // ── Money (finance area) ─────────────────────────────────
      // Money logs never touch points: computePoints only counts
      // complete/habit-check/journal kinds, and that is deliberate.
      logSpend: (categoryId, amount, note, date) =>
        set({
          logs: [
            ...get().logs,
            {
              id: uid(), itemId: categoryId ?? null, areaId: 'finance', kind: 'spend',
              amount, date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null,
              ...(note?.trim() && { note: note.trim() }),
            },
          ],
        }),

      /**
       * Pay a bill/subscription: log the payment (bill amount unless
       * overridden) and advance nextDue one cadence. The log stamps
       * prevDue so deleteMoneyLog can restore the exact prior date —
       * clamped dates (Jan 31 -> Feb 28) can't be reversed by math.
       */
      payBill: (billId, amountOverride, date) => {
        const bill = get().items.find((i) => i.id === billId && !i.deletedAt)
        if (!bill) return
        const amount = amountOverride ?? bill.amount
        if (amount == null) return
        const recurs = bill.nextDue && bill.cadence
        set({
          logs: [
            ...get().logs,
            {
              id: uid(), itemId: billId, areaId: 'finance', kind: 'bill-pay',
              amount, date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null,
              ...(recurs && { prevDue: bill.nextDue }),
            },
          ],
        })
        if (recurs) get().updateItem(billId, { nextDue: advanceDue(bill.nextDue, bill.cadence) })
      },

      contribute: (goalId, amount, date) =>
        set({
          logs: [
            ...get().logs,
            {
              id: uid(), itemId: goalId, areaId: 'finance', kind: 'contribute',
              amount, date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null,
            },
          ],
        }),

      /** Patch a live money log in place (e.g. assigning a category to an uncategorized spend). */
      updateMoneyLog: (logId, patch) =>
        set({
          logs: get().logs.map((l) =>
            l.id === logId && !l.deletedAt ? { ...l, ...patch, updatedAt: now() } : l,
          ),
        }),

      /** Tombstone a money log; un-paying a bill restores its prior due date. */
      deleteMoneyLog: (logId) => {
        const log = get().logs.find((l) => l.id === logId && !l.deletedAt)
        if (!log) return
        set({
          logs: get().logs.map((l) =>
            l.id === logId ? { ...l, deletedAt: now(), updatedAt: now() } : l,
          ),
        })
        if (log.kind === 'bill-pay' && log.prevDue) get().updateItem(log.itemId, { nextDue: log.prevDue })
      },

      // ── Fitness (the program, and logged sets) ───────────────
      // The program is ITEMs, not config: a session is a parent item in the
      // SESSION_BUCKET carrying `weekday`, and each exercise is one of its
      // sub-items carrying { sets, low, high, step }. That reuses the same
      // one-level parentId nesting Projects introduced, which is why
      // selectSubItems/reorderSubItems/archiveItem all work here for free —
      // and why every part of the plan is editable without a code change.
      //
      // A set log therefore points at a real ITEM: `itemId` is the exercise.
      // It adds only { weight, reps }, the same deliberate scalar concession
      // the money logs make.
      //
      // Set logs never touch points (computePoints counts only
      // complete/habit-check/journal), and rewards.js's band index skips
      // every kind but complete/habit-check — so an 18-set leg day cannot
      // swamp the daily-practice chart. Fitness's contribution there still
      // comes from its 'Top Priorities' habit bucket, unchanged.
      logSet: (itemId, weight, reps, date) =>
        set({
          logs: [
            ...get().logs,
            {
              id: uid(), itemId, areaId: 'fitness', kind: 'set', weight, reps,
              date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null,
            },
          ],
        }),

      /**
       * Build the starter program, once. Idempotent by construction: if any
       * session item already exists (even archived), this does nothing — so
       * it can be offered as a button without ever duplicating a plan the
       * user has since edited.
       */
      seedWorkoutProgram: () => {
        const existing = get().items.some(
          (i) => !i.deletedAt && i.areaId === 'fitness' && i.bucket === SESSION_BUCKET,
        )
        if (existing) return
        for (const session of DEFAULT_PROGRAM) {
          const parent = get().addItem('fitness', session.name, {
            bucket: SESSION_BUCKET,
            weekday: session.weekday,
          })
          for (const exercise of session.exercises) {
            get().addItem('fitness', exercise.title, { ...exercise, parentId: parent.id })
          }
        }
      },

      updateSet: (logId, patch) =>
        set({
          logs: get().logs.map((l) => (l.id === logId ? { ...l, ...patch, updatedAt: now() } : l)),
        }),

      /** Tombstone a logged set. Nothing derived needs unwinding — no points, no due dates. */
      deleteSet: (logId) =>
        set({
          logs: get().logs.map((l) =>
            l.id === logId ? { ...l, deletedAt: now(), updatedAt: now() } : l,
          ),
        }),

      /**
       * Build the starter stretch categories, once. Idempotent the same way
       * seedWorkoutProgram is, and for the same reason. The categories come
       * up empty — which stretches matter is the part only the user knows.
       */
      seedStretchCategories: () => {
        const existing = get().items.some(
          (i) => !i.deletedAt && i.areaId === 'fitness' && i.bucket === STRETCH_BUCKET,
        )
        if (existing) return
        for (const name of DEFAULT_STRETCH_CATEGORIES) {
          get().addItem('fitness', name, { bucket: STRETCH_BUCKET })
        }
      },

      // ── Notes / Journal ──────────────────────────────────────
      addNote: (areaId, text, itemId = null) => {
        const note = { id: uid(), areaId, itemId, text: text.trim(), createdAt: now(), updatedAt: now(), deletedAt: null }
        const logs =
          areaId === 'journal'
            ? [...get().logs, { id: uid(), itemId: null, areaId, kind: 'journal', date: todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null }]
            : get().logs
        set({
          notes: [...get().notes, note],
          logs,
          points: computePoints(logs),
        })
        return note
      },

      updateNote: (id, text) =>
        set({
          notes: get().notes.map((n) => (n.id === id ? { ...n, text, updatedAt: now() } : n)),
        }),

      deleteNote: (id) =>
        set({
          notes: get().notes.map((n) => (n.id === id ? { ...n, deletedAt: now(), updatedAt: now() } : n)),
        }),

      // ── Focus (Pomodoro) ─────────────────────────────────────
      /**
       * One completed work interval = one ordinary 'complete' log, itemId
       * null (same shape the journal day-marker already uses). This is the
       * entire dashboard/points integration -- rewards.js already sums any
       * complete/habit-check log by areaId for a daily-band area, so no
       * dedicated Focus code exists there.
       */
      logFocusSession: (date) => {
        const logs = [
          ...get().logs,
          { id: uid(), itemId: null, areaId: 'focus', kind: 'complete', date: date ?? todayKey(), createdAt: now(), updatedAt: now(), deletedAt: null },
        ]
        set({ logs, points: computePoints(logs) })
      },

      mergeRemote: (remoteEntities) => {
        const local = toEntities({ items: get().items, notes: get().notes, logs: get().logs })
        const merged = fromEntities(merge(local, remoteEntities))
        set({ items: merged.items, notes: merged.notes, logs: merged.logs, points: computePoints(merged.logs) })
      },
    }),
    {
      name: 'stoa',
      storage: createJSONStorage(() => idbStorage),
      version: 4,
      // v1 -> v2 added tombstones: pre-v2 records simply lack `deletedAt`,
      // and every consumer treats a missing field as "not deleted", so no
      // transformation is needed. (Bumping `version` with no `migrate`
      // would make zustand discard the whole store — never remove this.)
      //
      // v2 -> v3: the finance dashboard replaced the old list buckets.
      // Old finance items are remapped to their new homes with a fresh
      // updatedAt so the move wins last-write-wins sync merges.
      //
      // v3 -> v4: spending categories gained a `color`. Stamped once here so
      // every existing category keeps one fixed slot; a category that misses
      // this (created on a device still on v3, arriving by sync) falls back
      // to a hash of its id in categorySeries — same color, just underived.
      //
      // Each step is `if (version < N)` and the object is returned untouched
      // when no step changed anything, so a fresh v4 store pays nothing.
      migrate: (persistedState, version) => {
        if (!persistedState?.items) return persistedState
        let items = persistedState.items
        let touched = false
        const stamp = Date.now()

        if (version < 3) {
          const REMAP = { Fixed: 'Bills', Variable: 'Spending', Savings: 'Goals', Insurance: 'Other', Investments: 'Other' }
          const needsRemap = (i) => i.areaId === 'finance' && REMAP[i.bucket]
          if (items.some(needsRemap)) {
            touched = true
            items = items.map((i) => (needsRemap(i) ? { ...i, bucket: REMAP[i.bucket], updatedAt: stamp } : i))
          }
        }

        if (version < 4) {
          const needsColor = (i) => i.areaId === 'finance' && i.bucket === 'Spending' && i.color == null
          if (items.some(needsColor)) {
            touched = true
            let next = 0
            items = items.map((i) =>
              needsColor(i) ? { ...i, color: (next++ % SPEND_SERIES) + 1, updatedAt: stamp } : i,
            )
          }
        }

        return touched ? { ...persistedState, items } : persistedState
      },
    },
  ),
)

// ── Selectors ─────────────────────────────────────────────────
export const selectAreaItems = (areaId, showArchived = false) => (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.areaId === areaId && (showArchived ? i.status === 'archived' : i.status !== 'archived'))
    .sort((a, b) => a.order - b.order)

export const selectItemNotes = (itemId) => (s) =>
  s.notes.filter((n) => !n.deletedAt && n.itemId === itemId).sort((a, b) => b.createdAt - a.createdAt)

export const selectSubItems = (parentId) => (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.parentId === parentId && i.status !== 'archived')
    .sort((a, b) => a.order - b.order)

/** Program sessions, in user order. Archived sessions stay out of the way. */
export const selectWorkoutSessions = (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.areaId === 'fitness' && i.bucket === SESSION_BUCKET && i.status !== 'archived')
    .sort((a, b) => a.order - b.order)

/** Stretch categories, in user order. */
export const selectStretchCategories = (s) =>
  s.items
    .filter((i) => !i.deletedAt && i.areaId === 'fitness' && i.bucket === STRETCH_BUCKET && i.status !== 'archived')
    .sort((a, b) => a.order - b.order)

export const selectJournal = (s) =>
  s.notes.filter((n) => !n.deletedAt && n.areaId === 'journal' && !n.itemId).sort((a, b) => b.createdAt - a.createdAt)
