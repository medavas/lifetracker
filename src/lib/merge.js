/**
 * Pure sync primitives — shared by the client and the sync API.
 * Entity: { kind: 'item'|'note'|'log', id, updatedAt, deletedAt, data }.
 */
export const KINDS = ['item', 'note', 'log']
const plural = { item: 'items', note: 'notes', log: 'logs' }

const asEntity = (kind, o) => ({
  kind,
  id: o.id,
  updatedAt: o.updatedAt ?? o.createdAt ?? 0,
  deletedAt: o.deletedAt ?? null,
  data: o,
})

export function toEntities({ items = [], notes = [], logs = [] }) {
  return [
    ...items.map((o) => asEntity('item', o)),
    ...notes.map((o) => asEntity('note', o)),
    ...logs.map((o) => asEntity('log', o)),
  ]
}

export function fromEntities(entities) {
  const out = { items: [], notes: [], logs: [] }
  for (const e of entities) {
    if (KINDS.includes(e.kind)) out[plural[e.kind]].push(e.data)
  }
  return out
}

export function merge(a, b) {
  const byKey = new Map()
  for (const e of [...a, ...b]) {
    const key = `${e.kind}:${e.id}`
    const cur = byKey.get(key)
    if (!cur || e.updatedAt >= cur.updatedAt) byKey.set(key, e)
  }
  return [...byKey.values()]
}
