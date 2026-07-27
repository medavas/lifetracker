import { AREAS } from '../data/areas'

/**
 * Fuzzy capture: given free text, rank areas by likely relevance.
 * Lightweight on purpose — token match on area names + keyword lists.
 * Swap for a real fuzzy lib (fuse.js) if this stops being good enough.
 */
export function suggestAreas(text, limit = 3) {
  const t = text.toLowerCase()
  if (!t.trim()) return []
  const scored = AREAS.map((area) => {
    let score = 0
    if (t.includes(area.name.toLowerCase())) score += 5
    for (const kw of area.keywords) {
      if (t.includes(kw)) score += 3
    }
    for (const bucket of area.buckets) {
      if (t.includes(bucket.toLowerCase())) score += 2
    }
    return { area, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.area)
}
