# Area Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Work and Schedule areas and merge Budget into Finance, per `docs/superpowers/specs/2026-07-31-area-consolidation-design.md`.

**Architecture:** Areas are static config rows in `src/data/areas.js` (see `CLAUDE.md`'s 4-primitive rule). This is a config-only change — edit the `AREAS` array and update the one test file that asserts its exact shape. No other file references the `work`, `schedule`, or `budget` ids.

**Tech Stack:** React, Vitest.

## Global Constraints

- No data migration: confirmed no real items exist under `work`, `schedule`, or `budget` areaIds.
- `Projects` area (`id: 'projects'`) must remain byte-for-byte unchanged: buckets `Active, Backlog, Someday`.
- No new area kind, no schema change, no component change — `AreaView`/`areaById` stay generic.
- Trim colors are cosmetic only ("a thin edge/tint, never a fill" — identity is icon+name). The current registry pairs each of 6 trim tokens (`r,o,y,g,b,v`) across exactly 2 areas; after this change 9 areas remain, so exact pairing is no longer achievable (one token, `o`, drops out entirely since both its areas — `work` and `schedule` — are removed; `g` drops to a single area, `diet`, since `budget` is removed). Do not reassign any surviving area's trim to force a new pairing — leave existing trims as-is and update the test to assert the resulting real distribution.

---

### Task 1: Remove Work, remove Schedule, merge Budget into Finance

**Files:**
- Modify: `src/data/areas.js:17-90` (the `AREAS` array)
- Modify: `src/data/__tests__/areas.test.js` (the `EXPECTED` map and the trim-count assertion)

**Interfaces:**
- Consumes: nothing new — `AREAS` keeps its existing shape (`{ id, name, icon, kind, trim, keywords, buckets }` per row).
- Produces: `AREAS` now contains exactly 9 rows with ids `projects, finance, fitness, diet, health, habits, journal, philosophy, learnings` (in that order — `finance` stays in its current array position, `budget`'s row is deleted rather than moved).

- [ ] **Step 1: Update the failing test first — `src/data/__tests__/areas.test.js`**

Replace the whole file with:

```js
import { describe, it, expect } from 'vitest'
import * as lucide from 'lucide-react'
import { AREAS } from '../areas'

const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  fitness: { trim: 'r', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  habits: { trim: 'y', icon: 'KeyRound' },
  journal: { trim: 'v', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  learnings: { trim: 'b', icon: 'Brain' },
}

describe('area registry', () => {
  it('has exactly the 9 known areas', () => {
    expect(AREAS.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it('maps each area to the spec trim and lucide icon name', () => {
    for (const a of AREAS) {
      expect({ id: a.id, trim: a.trim, icon: a.icon }).toEqual({ id: a.id, ...EXPECTED[a.id] })
    }
  })

  it('uses each trim color at most twice', () => {
    const counts = {}
    for (const a of AREAS) counts[a.trim] = (counts[a.trim] || 0) + 1
    for (const count of Object.values(counts)) expect(count).toBeLessThanOrEqual(2)
  })

  it('every icon name resolves to a lucide component', () => {
    for (const a of AREAS) expect(typeof lucide[a.icon]).not.toBe('undefined')
  })

  it('gradients are gone from the registry', () => {
    for (const a of AREAS) expect(a.grad).toBeUndefined()
  })

  it('finance absorbed budget\'s buckets and keywords', () => {
    const finance = AREAS.find((a) => a.id === 'finance')
    expect(finance.buckets).toEqual(['Bills', 'Insurance', 'Investments', 'Savings', 'Fixed', 'Variable', 'Goals'])
    expect(finance.keywords).toEqual(
      expect.arrayContaining(['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay', 'budget', 'spend', 'expense', 'cost'])
    )
  })
})
```

- [ ] **Step 2: Run the test suite to verify it fails against the current registry**

Run: `npx vitest run src/data/__tests__/areas.test.js`
Expected: FAIL — `AREAS` still has 12 entries including `work`, `schedule`, `budget`, so the "has exactly the 9 known areas" and "finance absorbed budget's buckets" assertions fail.

- [ ] **Step 3: Edit `src/data/areas.js`**

Delete the `work` row (currently lines 36-41) and the `schedule` row (currently lines 60-65) entirely.

Replace the `finance` row (currently lines 24-29) with the merged version, and delete the separate `budget` row (currently lines 30-35):

```js
  {
    id: 'finance', name: 'Finance', icon: 'Wallet', kind: 'list',
    trim: 'y',
    keywords: ['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay', 'budget', 'spend', 'expense', 'cost'],
    buckets: ['Bills', 'Insurance', 'Investments', 'Savings', 'Fixed', 'Variable', 'Goals'],
  },
```

The resulting `AREAS` array must have exactly 9 rows in this order: `projects, finance, fitness, diet, health, habits, journal, philosophy, learnings`.

- [ ] **Step 4: Run the test suite to verify it passes**

Run: `npx vitest run src/data/__tests__/areas.test.js`
Expected: PASS — all 6 assertions green.

- [ ] **Step 5: Run the full test suite to confirm no other test depends on the removed ids**

Run: `npx vitest run`
Expected: PASS. (Tests in `src/lib/__tests__/*.test.js` use `'work'` only as an arbitrary `areaId` string fixture for store/sync CRUD logic, which doesn't validate against the `AREAS` registry — they are unaffected and out of scope for this change.)

- [ ] **Step 6: Manually verify the UI**

Run: `npm run dev`, open the app, confirm the area grid shows exactly the 9 areas listed above and that opening Finance shows all 7 merged buckets.

- [ ] **Step 7: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js
git commit -m "feat(areas): drop Work and Schedule, merge Budget into Finance"
```
