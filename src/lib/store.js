/**
 * Central store — the 4-primitive schema.
 *
 *  Area  - static config (src/data/areas.js), not stored.
 *  Item  - anything listed: task, habit, book, bill…   { id, areaId, bucket,
 *          title, details, type, status, order, createdAt, updatedAt,
 *          completedAt }
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
import { POINTS, todayKey } from './rewards'

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
        }
        set({ items: [...items, item] })
        return item
      },

      updateItem: (id, patch) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: now() } : i,
          ),
        }),

      /** Toggle done. Completing awards points + a log; unchecking reverses them. */
      toggleDone: (id) => {
        const item = get().items.find((i) => i.id === id)
        if (!item) return
        if (item.status === 'done') {
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, status: 'open', completedAt: null, updatedAt: now() } : i,
            ),
            logs: get().logs.filter(
              (l) => !(l.itemId === id && l.kind === 'complete' && l.date === todayKey()),
            ),
            points: Math.max(0, get().points - POINTS.task),
          })
        } else {
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, status: 'done', completedAt: now(), updatedAt: now() } : i,
            ),
            logs: [
              ...get().logs,
              { id: uid(), itemId: id, areaId: item.areaId, kind: 'complete', date: todayKey(), createdAt: now() },
            ],
            points: get().points + POINTS.task,
          })
        }
      },

      /** Explicit archive/restore — separate from done. */
      archiveItem: (id) => get().updateItem(id, { status: 'archived' }),
      restoreItem: (id) => get().updateItem(id, { status: 'open' }),
      deleteItem: (id) =>
        set({
          items: get().items.filter((i) => i.id !== id),
          notes: get().notes.filter((n) => n.itemId !== id),
          logs: get().logs.filter((l) => l.itemId !== id),
        }),

      reorderItems: (areaId, orderedIds) =>
        set({
          items: get().items.map((i) =>
            i.areaId === areaId && orderedIds.includes(i.id)
              ? { ...i, order: orderedIds.indexOf(i.id) }
              : i,
          ),
        }),

      // ── Habit check-ins ──────────────────────────────────────
      toggleHabitToday: (itemId) => {
        const { logs, items } = get()
        const date = todayKey()
        const existing = logs.find(
          (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === date,
        )
        if (existing) {
          set({
            logs: logs.filter((l) => l.id !== existing.id),
            points: Math.max(0, get().points - POINTS.habit),
          })
        } else {
          const item = items.find((i) => i.id === itemId)
          set({
            logs: [
              ...logs,
              { id: uid(), itemId, areaId: item?.areaId ?? 'habits', kind: 'habit-check', date, createdAt: now() },
            ],
            points: get().points + POINTS.habit,
          })
        }
      },

      isHabitCheckedToday: (itemId) =>
        get().logs.some(
          (l) => l.itemId === itemId && l.kind === 'habit-check' && l.date === todayKey(),
        ),

      // ── Notes / Journal ──────────────────────────────────────
      addNote: (areaId, text, itemId = null) => {
        const firstToday =
          areaId === 'journal' &&
          !get().notes.some(
            (n) => n.areaId === 'journal' && todayKey(new Date(n.createdAt)) === todayKey(),
          )
        const note = { id: uid(), areaId, itemId, text: text.trim(), createdAt: now(), updatedAt: now() }
        set({
          notes: [...get().notes, note],
          points: get().points + (firstToday ? POINTS.journal : 0),
          logs:
            areaId === 'journal'
              ? [...get().logs, { id: uid(), itemId: null, areaId, kind: 'journal', date: todayKey(), createdAt: now() }]
              : get().logs,
        })
        return note
      },

      updateNote: (id, text) =>
        set({
          notes: get().notes.map((n) => (n.id === id ? { ...n, text, updatedAt: now() } : n)),
        }),

      deleteNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
    }),
    {
      name: 'stoa',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
    },
  ),
)

// ── Selectors ─────────────────────────────────────────────────
export const selectAreaItems = (areaId, showArchived = false) => (s) =>
  s.items
    .filter((i) => i.areaId === areaId && (showArchived ? i.status === 'archived' : i.status !== 'archived'))
    .sort((a, b) => a.order - b.order)

export const selectItemNotes = (itemId) => (s) =>
  s.notes.filter((n) => n.itemId === itemId).sort((a, b) => b.createdAt - a.createdAt)

export const selectJournal = (s) =>
  s.notes.filter((n) => n.areaId === 'journal' && !n.itemId).sort((a, b) => b.createdAt - a.createdAt)
