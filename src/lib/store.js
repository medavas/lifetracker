/**
 * Central store — the 4-primitive schema.
 *
 *  Area  - static config (src/data/areas.js), not stored.
 *  Item  - anything listed: task, habit, book, bill…   { id, areaId, bucket,
 *          title, details, type, status, order, createdAt, updatedAt,
 *          completedAt }
 *          Nudge timers additionally carry { intervalMin, enabled }.
 *          A project sub-task additionally carries { parentId }, one level
 *          of nesting only — a sub-task cannot itself have sub-tasks.
 *  Log   - a dated record: habit check-ins, completions { id, itemId, areaId,
 *          kind, date, createdAt }
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

      mergeRemote: (remoteEntities) => {
        const local = toEntities({ items: get().items, notes: get().notes, logs: get().logs })
        const merged = fromEntities(merge(local, remoteEntities))
        set({ items: merged.items, notes: merged.notes, logs: merged.logs, points: computePoints(merged.logs) })
      },
    }),
    {
      name: 'stoa',
      storage: createJSONStorage(() => idbStorage),
      version: 2,
      // Bumping `version` with no `migrate` makes zustand's persist middleware
      // discard the persisted state entirely on the first load after the bump
      // (it logs a console.error and merges `undefined` into the fresh initial
      // state) — i.e. every existing item/log/note silently vanishes. Pre-v2
      // records simply lack a `deletedAt` field, and every tombstone-filtering
      // selector/computePoints already treats a missing `deletedAt` as "not
      // deleted" (`!undefined` is falsy), so no transformation is needed —
      // just hand the old state back unchanged.
      migrate: (persistedState) => persistedState,
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

export const selectJournal = (s) =>
  s.notes.filter((n) => !n.deletedAt && n.areaId === 'journal' && !n.itemId).sort((a, b) => b.createdAt - a.createdAt)
