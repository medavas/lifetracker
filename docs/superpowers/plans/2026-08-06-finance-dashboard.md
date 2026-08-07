# Finance Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Finance from a generic bucketed list into a dedicated dashboard: monthly budget plan, per-expense spend logging, recurring bills with mark-paid, subscription rollups, and savings goals — per the approved spec `docs/superpowers/specs/2026-08-06-finance-dashboard-design.md`.

**Architecture:** New area kind `'money'` with its own view (the Journal/Habits/Nudges mechanism). Bills, subscriptions, spending categories, goals, and plan rows are all ITEMs whose bucket carries their role; money movement is LOGs with an `amount`. All math is pure functions in `src/lib/finance.js`; components only render. No 5th primitive, no sync/server changes.

**Tech Stack:** React 19, zustand 5 (persist → IndexedDB), react-router-dom 7 (HashRouter), vitest 2 (node env — **no DOM tests**), plain global CSS, hand-rolled SVG charts. No new dependencies.

## Global Constraints

- **Branch baseline is `main`.** The repo currently sits on `projects-delinearized` with uncommitted WIP in `src/lib/store.js` and `src/lib/__tests__/store.test.js`. Create branch `finance-dashboard` **from `main`** (use superpowers:using-git-worktrees so the WIP working tree is untouched). All file contents quoted in this plan are main's versions.
- All money amounts are **integer cents**, everywhere. Never store or compute with float dollars; parse/format only at the UI edge via `src/lib/money.js`.
- The 4 primitives stand. New ITEM fields (`amount`, `cadence`, `nextDue`) and LOG fields (`amount`, `note`, `prevDue`) are optional and conditionally attached — exactly the existing `intervalMin` pattern in `addItem`. Sync (`src/lib/merge.js`) passes `data` through untouched: zero sync/server edits.
- Deletes are tombstones (`deletedAt` stamp), never splices. Every new selector/aggregation must skip `deletedAt` records.
- Money logs award **0 points**. `computePoints` in `src/lib/rewards.js` only counts `complete`/`habit-check`/`journal` kinds — do not modify it; tests assert points stay 0.
- No emoji anywhere in source (enforced by `src/lib/__tests__/no-emoji.test.js`). Use plain `$` text.
- vitest runs in a node environment with no DOM. Components cannot be unit-tested; all logic lives in pure lib modules with full coverage, and UI tasks verify via `npm test`, `npm run lint` (oxlint), and `npm run build`.
- CSS: plain global classes in `src/App.css`, design tokens from `src/index.css` only (`--surface-1..3`, `--border`, `--text-primary/secondary/muted`, `--trim-y`, `--series-*`, `--radius`, `--radius-sm`, `--shadow-card`). Finance chart bars use `--series-4` (amber family, matches finance's `y` trim). Color is trim/edge accents only, never big fills.
- Dates in LOG/`nextDue` are local `'YYYY-MM-DD'` strings (`todayKey()` from `src/lib/rewards.js`); months are `'YYYY-MM'` prefixes. Date arithmetic is pure integer math on the string parts (UTC construction only) so timezones can't shift a day.
- Run tests with `npx vitest run <file>` for a single file, `npm test` for the suite.

---

### Task 1: Money parse/format — `src/lib/money.js`

**Files:**
- Create: `src/lib/money.js`
- Test: `src/lib/__tests__/money.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseAmount(str) -> number|null` — user text to integer cents; `null` on anything not a positive amount.
  - `formatCents(cents) -> string` — `1450 -> '$14.50'`, `140000 -> '$1,400.00'`, negatives `-320 -> '-$3.20'`.
  - `centsToInput(cents) -> string` — `1450 -> '14.50'` (prefill for edit fields).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/money.test.js
import { describe, it, expect } from 'vitest'
import { parseAmount, formatCents, centsToInput } from '../money.js'

describe('parseAmount', () => {
  it('parses plain and decimal dollars to cents', () => {
    expect(parseAmount('14.50')).toBe(1450)
    expect(parseAmount('14.5')).toBe(1450)
    expect(parseAmount('14')).toBe(1400)
    expect(parseAmount('0.99')).toBe(99)
  })

  it('tolerates $ signs, commas, and whitespace', () => {
    expect(parseAmount(' $1,400.00 ')).toBe(140000)
    expect(parseAmount('$7')).toBe(700)
  })

  it('rejects non-positive and non-numeric input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
  })

  it('rounds sub-cent input to the nearest cent', () => {
    expect(parseAmount('1.005')).toBe(101)
    expect(parseAmount('1.004')).toBe(100)
  })
})

describe('formatCents', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatCents(1450)).toBe('$14.50')
    expect(formatCents(140000)).toBe('$1,400.00')
    expect(formatCents(0)).toBe('$0.00')
  })

  it('formats negatives with a leading minus', () => {
    expect(formatCents(-320)).toBe('-$3.20')
  })

  it('treats null/undefined as zero', () => {
    expect(formatCents(null)).toBe('$0.00')
    expect(formatCents(undefined)).toBe('$0.00')
  })
})

describe('centsToInput', () => {
  it('renders a bare two-decimal string for edit fields', () => {
    expect(centsToInput(1450)).toBe('14.50')
    expect(centsToInput(140000)).toBe('1400.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/money.test.js`
Expected: FAIL — cannot resolve `../money.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/money.js
/**
 * Money is integer CENTS everywhere in the store and lib layer; these
 * helpers are the only place dollars-as-text exists. parseAmount rejects
 * anything that is not a positive amount — callers treat null as
 * "don't submit".
 */

export function parseAmount(str) {
  if (typeof str !== 'string') return null
  const cleaned = str.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}

export function formatCents(cents) {
  const c = cents ?? 0
  const sign = c < 0 ? '-' : ''
  const abs = Math.abs(c)
  const dollars = Math.floor(abs / 100).toLocaleString('en-US')
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`
}

export function centsToInput(cents) {
  return ((cents ?? 0) / 100).toFixed(2)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/money.test.js`
Expected: PASS (all three describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.js src/lib/__tests__/money.test.js
git commit -m "feat(finance): money parse/format helpers, integer cents"
```

---

### Task 2: Date math + monthlyize — `src/lib/finance.js` (part 1)

**Files:**
- Create: `src/lib/finance.js`
- Test: `src/lib/__tests__/finance.test.js`

**Interfaces:**
- Consumes: nothing (pure module; no store imports).
- Produces:
  - `monthKey(dateStr) -> 'YYYY-MM'` — also works on a full `'YYYY-MM-DD'`.
  - `daysInMonth(month) -> number` — `'2026-02' -> 28`.
  - `addDays(dateStr, n) -> 'YYYY-MM-DD'`.
  - `advanceDue(dateStr, cadence) -> 'YYYY-MM-DD'` — next occurrence; monthly/yearly clamp to the destination month's last day; weekly is +7 days. (Un-pay does NOT reverse this math — it restores the payment log's `prevDue`, Task 4.)
  - `monthlyize(item) -> cents` — per-month cost: monthly as-is, yearly `/12`, weekly `*52/12`, rounded; `0` if no amount.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/finance.test.js
import { describe, it, expect } from 'vitest'
import { monthKey, daysInMonth, addDays, advanceDue, monthlyize } from '../finance.js'

describe('date helpers', () => {
  it('monthKey takes the YYYY-MM prefix', () => {
    expect(monthKey('2026-08-06')).toBe('2026-08')
    expect(monthKey('2026-08')).toBe('2026-08')
  })

  it('daysInMonth handles length and leap years', () => {
    expect(daysInMonth('2026-01')).toBe(31)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-04')).toBe(30)
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-06', 14)).toBe('2026-08-20')
    expect(addDays('2026-08-25', 14)).toBe('2026-09-08')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('advanceDue', () => {
  it('monthly advances one month, clamped to month end', () => {
    expect(advanceDue('2026-08-15', 'monthly')).toBe('2026-09-15')
    expect(advanceDue('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceDue('2026-12-15', 'monthly')).toBe('2027-01-15')
  })

  it('yearly advances one year, clamping Feb 29', () => {
    expect(advanceDue('2026-03-01', 'yearly')).toBe('2027-03-01')
    expect(advanceDue('2028-02-29', 'yearly')).toBe('2029-02-28')
  })

  it('weekly advances seven days', () => {
    expect(advanceDue('2026-08-28', 'weekly')).toBe('2026-09-04')
  })
})

describe('monthlyize', () => {
  it('passes monthly through, divides yearly, scales weekly', () => {
    expect(monthlyize({ amount: 1500, cadence: 'monthly' })).toBe(1500)
    expect(monthlyize({ amount: 12000, cadence: 'yearly' })).toBe(1000)
    expect(monthlyize({ amount: 1000, cadence: 'weekly' })).toBe(4333)
  })

  it('defaults a missing cadence to monthly and a missing amount to 0', () => {
    expect(monthlyize({ amount: 900 })).toBe(900)
    expect(monthlyize({ cadence: 'monthly' })).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/finance.test.js`
Expected: FAIL — cannot resolve `../finance.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/finance.js
/**
 * Pure finance math — no store imports, no Date.now(), fully unit-tested
 * (the chart.js/stackGeometry house pattern: vitest runs in node with no
 * DOM, so anything a component needs computed lives here instead).
 *
 * All amounts are integer cents. All dates are local 'YYYY-MM-DD' strings;
 * arithmetic parses the parts and reconstructs via UTC so a timezone can
 * never shift a day.
 */

export const monthKey = (dateStr) => dateStr.slice(0, 7)

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const pad2 = (n) => String(n).padStart(2, '0')

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/**
 * Next occurrence of a bill. Monthly/yearly clamp to the destination
 * month's last day (Jan 31 -> Feb 28). Deliberately NOT reversible —
 * un-paying restores the payment log's `prevDue` instead of reversing
 * this math, because a clamped date can't be walked back (Feb 28 would
 * "retreat" to Jan 28).
 */
export function advanceDue(dateStr, cadence) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (cadence === 'weekly') return addDays(dateStr, 7)
  const months = cadence === 'yearly' ? 12 : 1
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`
}

/** Per-month cost of a bill/subscription item, in cents. */
export function monthlyize(item) {
  const amount = item.amount ?? 0
  if (item.cadence === 'yearly') return Math.round(amount / 12)
  if (item.cadence === 'weekly') return Math.round((amount * 52) / 12)
  return amount
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/finance.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.js src/lib/__tests__/finance.test.js
git commit -m "feat(finance): date math and monthlyize, month-end clamped"
```

---

### Task 3: Aggregations + chart geometry — `src/lib/finance.js` (part 2)

**Files:**
- Modify: `src/lib/finance.js` (append)
- Test: `src/lib/__tests__/finance.test.js` (append)

**Interfaces:**
- Consumes: Task 2's helpers; ITEM/LOG shapes from `src/lib/store.js` (plain objects).
- Produces (all skip `deletedAt` records; "live item" = `!deletedAt && status !== 'archived'`):
  - `financeItems(items) -> item[]` — live finance-area items.
  - `monthActuals(items, logs, month) -> { spendByCategory, totalSpend, billsPaid, contributed }` — `spendByCategory` is an object keyed by category itemId, with key `'uncategorized'` for spends whose item is missing/hard-deleted (totals stay truthful).
  - `budgetSummary(items, logs, month) -> { income, savingsPlan, fixed, limits, unallocated, spent, remaining }` — all cents. Plan-bucket items are discriminated by ITEM `type`: `'income'` vs `'savings'`.
  - `upcomingBills(items, todayStr, horizonDays = 14) -> bill[]` — Bills+Subscriptions with a `nextDue` within horizon or overdue; each gets `overdue: boolean`; sorted by `nextDue` ascending.
  - `goalProgress(logs, goalId) -> cents` — sum of live `contribute` logs.
  - `subscriptionRollup(items) -> { monthly, yearly }` — cents over the Subscriptions bucket.
  - `dailySpend(logs, month) -> number[]` — one cents total per day of the month (index 0 = day 1), `spend` logs only.
  - `spendBars(dayTotals, opts?) -> bar[]` — SVG geometry `{ day, x, y, w, h, total }` per day; opts `{ width = 320, height = 96, pad = 4, gap = 2 }`; heights scale to the max day (min 1).

- [ ] **Step 1: Write the failing tests** (append to `src/lib/__tests__/finance.test.js`)

```js
import {
  financeItems, monthActuals, budgetSummary, upcomingBills,
  goalProgress, subscriptionRollup, dailySpend, spendBars,
} from '../finance.js'

const fin = (bucket, extra = {}) => ({
  id: extra.id ?? `${bucket}-${Math.random().toString(36).slice(2, 7)}`,
  areaId: 'finance', bucket, title: extra.title ?? bucket,
  status: 'open', deletedAt: null, ...extra,
})
const spend = (itemId, amount, date, extra = {}) =>
  ({ id: `l-${Math.random().toString(36).slice(2, 7)}`, itemId, areaId: 'finance', kind: 'spend', amount, date, deletedAt: null, ...extra })

describe('financeItems', () => {
  it('keeps live finance items, drops archived, deleted, and other areas', () => {
    const items = [
      fin('Bills', { id: 'b1' }),
      fin('Bills', { id: 'b2', status: 'archived' }),
      fin('Bills', { id: 'b3', deletedAt: 123 }),
      { id: 'x', areaId: 'fitness', bucket: 'Goals', status: 'open', deletedAt: null },
    ]
    expect(financeItems(items).map((i) => i.id)).toEqual(['b1'])
  })
})

describe('monthActuals', () => {
  const cat = fin('Spending', { id: 'groceries', amount: 40000 })

  it('sums spends per category for the month only', () => {
    const logs = [
      spend('groceries', 1450, '2026-08-02'),
      spend('groceries', 550, '2026-08-15'),
      spend('groceries', 9999, '2026-07-30'),
    ]
    const a = monthActuals([cat], logs, '2026-08')
    expect(a.spendByCategory.groceries).toBe(2000)
    expect(a.totalSpend).toBe(2000)
  })

  it('routes spends with a missing item to uncategorized', () => {
    const a = monthActuals([cat], [spend('gone-id', 700, '2026-08-03'), spend(null, 300, '2026-08-04')], '2026-08')
    expect(a.spendByCategory.uncategorized).toBe(1000)
    expect(a.totalSpend).toBe(1000)
  })

  it('ignores tombstoned logs and tallies bill-pays and contributions separately', () => {
    const logs = [
      spend('groceries', 500, '2026-08-01', { deletedAt: 5 }),
      { id: 'p1', itemId: 'rent', areaId: 'finance', kind: 'bill-pay', amount: 120000, date: '2026-08-01', deletedAt: null },
      { id: 'c1', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 10000, date: '2026-08-02', deletedAt: null },
    ]
    const a = monthActuals([cat], logs, '2026-08')
    expect(a.totalSpend).toBe(0)
    expect(a.billsPaid).toBe(120000)
    expect(a.contributed).toBe(10000)
  })
})

describe('budgetSummary', () => {
  const items = [
    fin('Plan', { id: 'sal', type: 'income', amount: 500000 }),
    fin('Plan', { id: 'sav', type: 'savings', amount: 50000 }),
    fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly', nextDue: '2026-08-01' }),
    fin('Subscriptions', { id: 'tv', amount: 12000, cadence: 'yearly', nextDue: '2027-01-10' }),
    fin('Spending', { id: 'groceries', amount: 40000 }),
    fin('Spending', { id: 'fun', amount: 20000 }),
  ]

  it('computes income, fixed, limits, and the unallocated remainder', () => {
    const s = budgetSummary(items, [], '2026-08')
    expect(s.income).toBe(500000)
    expect(s.savingsPlan).toBe(50000)
    expect(s.fixed).toBe(121000) // rent 1200.00 + tv 120.00/12 = 10.00
    expect(s.limits).toBe(60000)
    expect(s.unallocated).toBe(500000 - 121000 - 50000 - 60000)
  })

  it('tracks spent and remaining against the limits', () => {
    const s = budgetSummary(items, [spend('groceries', 15000, '2026-08-05')], '2026-08')
    expect(s.spent).toBe(15000)
    expect(s.remaining).toBe(45000)
  })
})

describe('upcomingBills', () => {
  const items = [
    fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly', nextDue: '2026-08-10' }),
    fin('Subscriptions', { id: 'tv', amount: 1500, cadence: 'monthly', nextDue: '2026-08-08' }),
    fin('Bills', { id: 'late', amount: 4000, cadence: 'monthly', nextDue: '2026-08-01' }),
    fin('Bills', { id: 'far', amount: 9000, cadence: 'monthly', nextDue: '2026-09-25' }),
    fin('Bills', { id: 'nodate', amount: 5000, cadence: 'monthly' }),
  ]

  it('returns overdue + due-within-horizon, sorted by date', () => {
    const bills = upcomingBills(items, '2026-08-06', 14)
    expect(bills.map((b) => b.id)).toEqual(['late', 'tv', 'rent'])
    expect(bills.find((b) => b.id === 'late').overdue).toBe(true)
    expect(bills.find((b) => b.id === 'rent').overdue).toBe(false)
  })
})

describe('goals + subscriptions', () => {
  it('goalProgress sums live contribute logs for the goal', () => {
    const logs = [
      { id: '1', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 10000, date: '2026-07-01', deletedAt: null },
      { id: '2', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 5000, date: '2026-08-01', deletedAt: null },
      { id: '3', itemId: 'g1', areaId: 'finance', kind: 'contribute', amount: 9999, date: '2026-08-02', deletedAt: 7 },
      { id: '4', itemId: 'g2', areaId: 'finance', kind: 'contribute', amount: 777, date: '2026-08-02', deletedAt: null },
    ]
    expect(goalProgress(logs, 'g1')).toBe(15000)
  })

  it('subscriptionRollup totals the Subscriptions bucket monthly and yearly', () => {
    const items = [
      fin('Subscriptions', { id: 'a', amount: 1500, cadence: 'monthly' }),
      fin('Subscriptions', { id: 'b', amount: 12000, cadence: 'yearly' }),
      fin('Bills', { id: 'rent', amount: 120000, cadence: 'monthly' }),
    ]
    const r = subscriptionRollup(items)
    expect(r.monthly).toBe(2500)
    expect(r.yearly).toBe(30000)
  })
})

describe('dailySpend + spendBars', () => {
  it('buckets spend logs by day of month', () => {
    const logs = [
      spend('c', 1000, '2026-08-01'),
      spend('c', 500, '2026-08-01'),
      spend('c', 200, '2026-08-31'),
      spend('c', 9999, '2026-07-31'),
      { id: 'p', itemId: 'rent', areaId: 'finance', kind: 'bill-pay', amount: 99, date: '2026-08-01', deletedAt: null },
    ]
    const days = dailySpend(logs, '2026-08')
    expect(days).toHaveLength(31)
    expect(days[0]).toBe(1500)
    expect(days[30]).toBe(200)
    expect(days[1]).toBe(0)
  })

  it('spendBars scales heights to the max day within the plot box', () => {
    const bars = spendBars([1000, 0, 500], { width: 90, height: 100, pad: 0, gap: 0 })
    expect(bars).toHaveLength(3)
    expect(bars[0].h).toBe(100)
    expect(bars[2].h).toBe(50)
    expect(bars[1].h).toBe(0)
    expect(bars[0].w).toBe(30)
    expect(bars[2].x).toBe(60)
    expect(bars[0].y).toBe(0)
    expect(bars[2].y).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/finance.test.js`
Expected: FAIL — the new imports are undefined (Task 2 tests still pass).

- [ ] **Step 3: Write the implementation** (append to `src/lib/finance.js`)

```js
/** Live (not deleted, not archived) finance-area items. */
export const financeItems = (items) =>
  items.filter((i) => !i.deletedAt && i.areaId === 'finance' && i.status !== 'archived')

const liveLogs = (logs, month) =>
  logs.filter((l) => !l.deletedAt && l.date.startsWith(month))

/**
 * The month's money movement. Spends whose item no longer resolves land
 * under 'uncategorized' — the money actually left, so totals stay
 * truthful even after a category is hard-deleted.
 */
export function monthActuals(items, logs, month) {
  const known = new Set(items.filter((i) => !i.deletedAt).map((i) => i.id))
  const spendByCategory = {}
  let totalSpend = 0
  let billsPaid = 0
  let contributed = 0
  for (const l of liveLogs(logs, month)) {
    const amount = l.amount ?? 0
    if (l.kind === 'spend') {
      const key = l.itemId && known.has(l.itemId) ? l.itemId : 'uncategorized'
      spendByCategory[key] = (spendByCategory[key] ?? 0) + amount
      totalSpend += amount
    } else if (l.kind === 'bill-pay') {
      billsPaid += amount
    } else if (l.kind === 'contribute') {
      contributed += amount
    }
  }
  return { spendByCategory, totalSpend, billsPaid, contributed }
}

const sumAmounts = (list) => list.reduce((s, i) => s + (i.amount ?? 0), 0)

/**
 * The monthly plan vs. this month's reality, all cents.
 * Plan-bucket items are discriminated by ITEM `type`:
 * 'income' rows sum to income, 'savings' rows to the savings allocation.
 */
export function budgetSummary(items, logs, month) {
  const live = financeItems(items)
  const plan = live.filter((i) => i.bucket === 'Plan')
  const income = sumAmounts(plan.filter((i) => i.type === 'income'))
  const savingsPlan = sumAmounts(plan.filter((i) => i.type === 'savings'))
  const fixed = live
    .filter((i) => i.bucket === 'Bills' || i.bucket === 'Subscriptions')
    .reduce((s, i) => s + monthlyize(i), 0)
  const limits = sumAmounts(live.filter((i) => i.bucket === 'Spending'))
  const { totalSpend } = monthActuals(items, logs, month)
  return {
    income, savingsPlan, fixed, limits,
    unallocated: income - fixed - savingsPlan - limits,
    spent: totalSpend,
    remaining: limits - totalSpend,
  }
}

/** Bills + subscriptions due within the horizon (or overdue), soonest first. */
export function upcomingBills(items, todayStr, horizonDays = 14) {
  const limit = addDays(todayStr, horizonDays)
  return financeItems(items)
    .filter((i) => (i.bucket === 'Bills' || i.bucket === 'Subscriptions') && i.nextDue && i.nextDue <= limit)
    .map((i) => ({ ...i, overdue: i.nextDue < todayStr }))
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))
}

/** Total saved toward a goal: the sum of its live contribute logs. */
export const goalProgress = (logs, goalId) =>
  logs
    .filter((l) => !l.deletedAt && l.kind === 'contribute' && l.itemId === goalId)
    .reduce((s, l) => s + (l.amount ?? 0), 0)

/** What all subscriptions cost, per month and per year. */
export function subscriptionRollup(items) {
  const subs = financeItems(items).filter((i) => i.bucket === 'Subscriptions')
  const monthly = subs.reduce((s, i) => s + monthlyize(i), 0)
  return { monthly, yearly: monthly * 12 }
}

/** Cents spent per day of the month, index 0 = day 1. 'spend' logs only. */
export function dailySpend(logs, month) {
  const days = new Array(daysInMonth(month)).fill(0)
  for (const l of liveLogs(logs, month)) {
    if (l.kind !== 'spend') continue
    days[Number(l.date.slice(8, 10)) - 1] += l.amount ?? 0
  }
  return days
}

/**
 * SVG bar geometry for the daily-spend chart, kept out of the component
 * so it can be tested (stackGeometry pattern — SVG y grows downward).
 */
export function spendBars(dayTotals, opts = {}) {
  const { width = 320, height = 96, pad = 4, gap = 2 } = opts
  const colW = (width - pad * 2) / Math.max(1, dayTotals.length)
  const max = Math.max(1, ...dayTotals)
  return dayTotals.map((total, i) => {
    const h = (total / max) * height
    return {
      day: i + 1,
      x: pad + i * colW + gap / 2,
      y: height - h,
      w: Math.max(1, colW - gap),
      h,
      total,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/finance.test.js`
Expected: PASS — all describes.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` — expected all green.

```bash
git add src/lib/finance.js src/lib/__tests__/finance.test.js
git commit -m "feat(finance): budget, bills, goals, and chart math"
```

---

### Task 4: Store — money fields and actions

**Files:**
- Modify: `src/lib/store.js` (main's version: `addItem` at ~line 47, actions after `toggleHabitToday`)
- Test: `src/lib/__tests__/store.test.js` (append)

**Interfaces:**
- Consumes: `advanceDue` from `src/lib/finance.js`; `todayKey` from `src/lib/rewards.js` (already imported).
- Produces (store actions):
  - `addItem(areaId, title, extra)` now also persists `extra.amount`, `extra.cadence`, `extra.nextDue` (conditionally attached).
  - `logSpend(categoryId, amount, note?, date?)` — `kind: 'spend'` log; `categoryId` may be `null` (uncategorized); `note` attached only when non-empty.
  - `payBill(billId, amountOverride?, date?)` — `kind: 'bill-pay'` log at the bill's amount (or override); records `prevDue` and advances the bill's `nextDue` when the bill has both `nextDue` and `cadence`. No-ops without a resolvable amount.
  - `contribute(goalId, amount, date?)` — `kind: 'contribute'` log.
  - `deleteMoneyLog(logId)` — tombstones the log; a `bill-pay` log with `prevDue` also restores the bill's `nextDue` to it.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/__tests__/store.test.js`, matching the file's existing `reset`/`getState` style)

```js
describe('money fields on items', () => {
  beforeEach(reset)

  it('persists amount, cadence, and nextDue when supplied', () => {
    const b = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-09-01',
    })
    const stored = useStore.getState().items.find((i) => i.id === b.id)
    expect(stored.amount).toBe(120000)
    expect(stored.cadence).toBe('monthly')
    expect(stored.nextDue).toBe('2026-09-01')
  })

  it('leaves ordinary items free of money fields', () => {
    const it_ = useStore.getState().addItem('projects', 'ship it')
    const stored = useStore.getState().items.find((i) => i.id === it_.id)
    expect('amount' in stored).toBe(false)
    expect('cadence' in stored).toBe(false)
    expect('nextDue' in stored).toBe(false)
  })
})

describe('money logs', () => {
  beforeEach(reset)

  it('logSpend writes a spend log and awards no points', () => {
    const cat = useStore.getState().addItem('finance', 'Groceries', { bucket: 'Spending', amount: 40000 })
    useStore.getState().logSpend(cat.id, 1450, 'coffee')
    const log = useStore.getState().logs.find((l) => l.kind === 'spend')
    expect(log.itemId).toBe(cat.id)
    expect(log.amount).toBe(1450)
    expect(log.note).toBe('coffee')
    expect(log.areaId).toBe('finance')
    expect(useStore.getState().points).toBe(0)
  })

  it('logSpend without a category or note stays uncategorized and note-free', () => {
    useStore.getState().logSpend(null, 300)
    const log = useStore.getState().logs.find((l) => l.kind === 'spend')
    expect(log.itemId).toBeNull()
    expect('note' in log).toBe(false)
  })

  it('payBill logs the bill amount, stamps prevDue, and advances nextDue', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-01-31',
    })
    useStore.getState().payBill(bill.id)
    const log = useStore.getState().logs.find((l) => l.kind === 'bill-pay')
    expect(log.amount).toBe(120000)
    expect(log.prevDue).toBe('2026-01-31')
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-02-28')
    expect(useStore.getState().points).toBe(0)
  })

  it('payBill without any amount is a no-op', () => {
    const bill = useStore.getState().addItem('finance', 'Mystery', {
      bucket: 'Bills', cadence: 'monthly', nextDue: '2026-09-01',
    })
    useStore.getState().payBill(bill.id)
    expect(useStore.getState().logs).toHaveLength(0)
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-09-01')
  })

  it('deleteMoneyLog on a payment restores the exact prior due date', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-01-31',
    })
    useStore.getState().payBill(bill.id)
    const log = useStore.getState().logs.find((l) => l.kind === 'bill-pay')
    useStore.getState().deleteMoneyLog(log.id)
    expect(useStore.getState().logs.find((l) => l.id === log.id).deletedAt).toBeTruthy()
    expect(useStore.getState().items.find((i) => i.id === bill.id).nextDue).toBe('2026-01-31')
  })

  it('contribute writes a contribute log toward the goal', () => {
    const goal = useStore.getState().addItem('finance', 'Emergency fund', { bucket: 'Goals', amount: 500000 })
    useStore.getState().contribute(goal.id, 25000)
    const log = useStore.getState().logs.find((l) => l.kind === 'contribute')
    expect(log.itemId).toBe(goal.id)
    expect(log.amount).toBe(25000)
    expect(useStore.getState().points).toBe(0)
  })

  it('money fields round-trip through a sync merge', () => {
    const bill = useStore.getState().addItem('finance', 'Rent', {
      bucket: 'Bills', amount: 120000, cadence: 'monthly', nextDue: '2026-09-01',
    })
    const remote = [{
      kind: 'item', id: bill.id, updatedAt: bill.updatedAt + 1000, deletedAt: null,
      data: { ...bill, amount: 125000, nextDue: '2026-10-01', updatedAt: bill.updatedAt + 1000 },
    }]
    useStore.getState().mergeRemote(remote)
    const merged = useStore.getState().items.find((i) => i.id === bill.id)
    expect(merged.amount).toBe(125000)
    expect(merged.nextDue).toBe('2026-10-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/store.test.js`
Expected: FAIL — `logSpend` is not a function; the money-fields tests fail on missing `amount`.

- [ ] **Step 3: Implement**

3a. Add the import at the top of `src/lib/store.js`:

```js
import { advanceDue } from './finance'
```

3b. In `addItem`, directly under the existing `intervalMin` conditional spread, add:

```js
          // Finance items only (money area kind). Same conditional-attachment
          // pattern as intervalMin — bills carry all three, categories/goals
          // just amount; merge.js syncs them with no sync-layer change.
          ...(extra.amount != null && { amount: extra.amount }),
          ...(extra.cadence != null && { cadence: extra.cadence }),
          ...(extra.nextDue != null && { nextDue: extra.nextDue }),
```

3c. Add the money actions after `isHabitCheckedToday` (before the Notes section):

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/store.test.js`
Expected: PASS — new describes green, existing describes untouched.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` — all green (points/rewards tests prove the 0-points rule held).

```bash
git add src/lib/store.js src/lib/__tests__/store.test.js
git commit -m "feat(finance): money fields on items, spend/pay/contribute actions"
```

---

### Task 5: Persist migration v3 — old finance buckets remap

**Files:**
- Modify: `src/lib/store.js` (persist options, ~line 198)
- Test: `src/lib/__tests__/store-migrate.test.js` (append; existing tests must keep passing)

**Interfaces:**
- Consumes: persisted state shape `{ items, logs, notes, points }`.
- Produces: persist `version: 3`; `migrate(persistedState, version)` that remaps old finance buckets (Fixed→Bills, Variable→Spending, Savings→Goals, Insurance→Other, Investments→Other; Bills/Goals unchanged) with a fresh `updatedAt` so the change wins sync merges. **Returns the persisted object unchanged (same reference) when nothing needs remapping** — the existing passthrough test asserts identity.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/__tests__/store-migrate.test.js`)

```js
describe('v3 migration remaps old finance buckets', () => {
  it('moves each old bucket to its dashboard home and stamps updatedAt', () => {
    const { migrate } = useStore.persist.getOptions()
    const mk = (id, bucket) => ({
      id, areaId: 'finance', bucket, title: id, status: 'open',
      order: 0, createdAt: 1, updatedAt: 1, completedAt: null, deletedAt: null,
    })
    const v2 = {
      items: [
        mk('a', 'Bills'), mk('b', 'Fixed'), mk('c', 'Variable'),
        mk('d', 'Savings'), mk('e', 'Goals'), mk('f', 'Insurance'), mk('g', 'Investments'),
        { ...mk('h', 'Active'), areaId: 'projects' },
      ],
      logs: [], notes: [], points: 0,
    }
    const out = migrate(v2, 2)
    const bucketOf = (id) => out.items.find((i) => i.id === id).bucket
    expect(bucketOf('a')).toBe('Bills')
    expect(bucketOf('b')).toBe('Bills')
    expect(bucketOf('c')).toBe('Spending')
    expect(bucketOf('d')).toBe('Goals')
    expect(bucketOf('e')).toBe('Goals')
    expect(bucketOf('f')).toBe('Other')
    expect(bucketOf('g')).toBe('Other')
    expect(out.items.find((i) => i.id === 'h').bucket).toBe('Active')
    expect(out.items.find((i) => i.id === 'b').updatedAt).toBeGreaterThan(1)
    expect(out.items.find((i) => i.id === 'a').updatedAt).toBe(1) // already home — untouched
  })

  it('returns the same object when nothing needs remapping', () => {
    const { migrate } = useStore.persist.getOptions()
    const clean = { items: [{ id: 'x', areaId: 'projects', bucket: 'Active', updatedAt: 1 }], logs: [], notes: [], points: 0 }
    expect(migrate(clean, 2)).toBe(clean)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/store-migrate.test.js`
Expected: FAIL — buckets come back unchanged (current migrate is a passthrough).

- [ ] **Step 3: Implement** — replace the persist `version`/`migrate` block in `src/lib/store.js` with:

```js
      version: 3,
      // v1 -> v2 added tombstones: pre-v2 records simply lack `deletedAt`,
      // and every consumer treats a missing field as "not deleted", so no
      // transformation is needed. (Bumping `version` with no `migrate`
      // would make zustand discard the whole store — never remove this.)
      //
      // v2 -> v3: the finance dashboard replaced the old list buckets.
      // Old finance items are remapped to their new homes with a fresh
      // updatedAt so the move wins last-write-wins sync merges. When
      // nothing needs remapping the persisted object is returned as-is.
      migrate: (persistedState, version) => {
        if (version >= 3 || !persistedState?.items) return persistedState
        const REMAP = { Fixed: 'Bills', Variable: 'Spending', Savings: 'Goals', Insurance: 'Other', Investments: 'Other' }
        const needsRemap = (i) => i.areaId === 'finance' && REMAP[i.bucket]
        if (!persistedState.items.some(needsRemap)) return persistedState
        const stamp = Date.now()
        return {
          ...persistedState,
          items: persistedState.items.map((i) =>
            needsRemap(i) ? { ...i, bucket: REMAP[i.bucket], updatedAt: stamp } : i,
          ),
        }
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/store-migrate.test.js`
Expected: PASS — including the two pre-existing tests (the v1 passthrough state has no finance items, so identity is preserved).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.js src/lib/__tests__/store-migrate.test.js
git commit -m "feat(finance): v3 persist migration remaps old finance buckets"
```

---

### Task 6: Registry, route, and dashboard skeleton

**Files:**
- Modify: `src/data/areas.js` (finance row + kind doc comment)
- Modify: `src/data/__tests__/areas.test.js`
- Modify: `src/App.jsx` (route)
- Modify: `CLAUDE.md` (kind list + money concessions)
- Create: `src/views/FinanceDashboard.jsx` (skeleton: page chrome + month state + summary header)
- Modify: `src/App.css` (finance base styles)

**Interfaces:**
- Consumes: `budgetSummary`, `monthKey` (Task 3), `formatCents` (Task 1), `todayKey` from rewards.
- Produces:
  - Finance registry row: `kind: 'money'`, `route: '/finance'`, buckets `['Plan', 'Bills', 'Subscriptions', 'Spending', 'Goals', 'Other']`, keywords + `'subscription'`.
  - Route `/finance` → `<FinanceDashboard />`.
  - `FinanceDashboard` holds `const [month, setMonth] = useState(() => monthKey(todayKey()))` and renders `<section className="fin-section">` slots that Tasks 7–10 fill; passes `month` down.
  - Helper `shiftMonth(month, delta) -> 'YYYY-MM'` added to `src/lib/finance.js`.

- [ ] **Step 1: Update the registry tests first** (they lock the registry — change them to demand the new shape). In `src/data/__tests__/areas.test.js`:

Replace the `finance absorbed budget's buckets and keywords` test with:

```js
  it('finance is the money kind with the dashboard buckets', () => {
    const finance = AREAS.find((a) => a.id === 'finance')
    expect(finance.kind).toBe('money')
    expect(finance.route).toBe('/finance')
    expect(finance.buckets).toEqual(['Plan', 'Bills', 'Subscriptions', 'Spending', 'Goals', 'Other'])
    expect(finance.keywords).toEqual(expect.arrayContaining(['money', 'bill', 'subscription', 'budget', 'spend']))
  })
```

Replace the `routes the three non-generic areas to their own pages` test body with:

```js
    const routes = Object.fromEntries(AREAS.map((a) => [a.id, routeFor(a)]))
    expect(routes.journal).toBe('/journal')
    expect(routes.habits).toBe('/habits')
    expect(routes.nudges).toBe('/nudges')
    expect(routes.finance).toBe('/finance')
```

(rename it to `routes the four non-generic areas to their own pages`), and in `routes every other area through the generic area view` add `'finance'` to the skip list:

```js
      if (['journal', 'habits', 'nudges', 'finance'].includes(a.id)) continue
```

- [ ] **Step 2: Run to verify the registry tests fail**

Run: `npx vitest run src/data/__tests__/areas.test.js`
Expected: FAIL — finance still `kind: 'list'` with old buckets.

- [ ] **Step 3: Update the registry.** In `src/data/areas.js`, add `'money'` to the kind doc comment (after the `'timers'` line):

```
 *  - 'money'   - the finance dashboard: budget plan, bills, spending, goals
```

and replace the finance row with:

```js
  {
    id: 'finance', name: 'Finance', icon: 'Wallet', kind: 'money',
    trim: 'y', route: '/finance',
    keywords: ['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay', 'budget', 'spend', 'expense', 'cost', 'subscription'],
    buckets: ['Plan', 'Bills', 'Subscriptions', 'Spending', 'Goals', 'Other'],
  },
```

- [ ] **Step 4: Add `shiftMonth` to `src/lib/finance.js`** with a test appended to `src/lib/__tests__/finance.test.js`:

Test:

```js
describe('shiftMonth', () => {
  it('steps across year boundaries in both directions', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
```

Implementation:

```js
/** 'YYYY-MM' plus delta months. */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad2((total % 12 + 12) % 12 + 1)}`
}
```

(add `shiftMonth` to the test file's existing `from '../finance.js'` import)

- [ ] **Step 5: Create the skeleton view** `src/views/FinanceDashboard.jsx`:

```jsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectAreaItems } from '../lib/store'
import { areaById } from '../data/areas'
import { monthKey, shiftMonth, budgetSummary, daysInMonth } from '../lib/finance'
import { formatCents } from '../lib/money'
import { todayKey } from '../lib/rewards'
import AreaIcon from '../components/AreaIcon'

/**
 * The 'money' area kind's dedicated page — the one view not rendered by
 * the generic AreaView, same mechanism as Journal/Habits/Nudges. All
 * math comes from lib/finance.js; this file only lays out sections.
 */
export default function FinanceDashboard() {
  const area = areaById('finance')
  const [month, setMonth] = useState(() => monthKey(todayKey()))
  const items = useStore(useShallow(selectAreaItems('finance')))
  const logs = useStore((s) => s.logs)

  const summary = budgetSummary(items, logs, month)
  const current = month === monthKey(todayKey())
  const daysLeft = current ? daysInMonth(month) - Number(todayKey().slice(8, 10)) : 0
  const pct = summary.limits > 0 ? Math.min(100, (summary.spent / summary.limits) * 100) : 0

  const monthLabel = new Date(`${month}-15T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="page" style={{ '--area-c1': `var(--trim-${area.trim})` }}>
      <div className="page-head">
        <div className="icon-chip"><AreaIcon name={area.icon} /></div>
        <h1>{area.name}</h1>
      </div>

      <div className="fin-month">
        <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <span>{monthLabel}</span>
        <button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>

      <section className="fin-section card">
        <div className="fin-headline">
          <strong>{formatCents(summary.spent)}</strong>
          <span className="fin-sub"> of {formatCents(summary.limits)} spending</span>
          {current && <span className="fin-sub"> · {daysLeft}d left</span>}
        </div>
        <div className="fin-track"><div className="fin-fill" style={{ width: `${pct}%` }} /></div>
        <div className="fin-planline">
          <span>Income {formatCents(summary.income)}</span>
          <span>Fixed {formatCents(summary.fixed)}</span>
          <span>Savings {formatCents(summary.savingsPlan)}</span>
          <span className={summary.unallocated < 0 ? 'fin-neg' : ''}>Unallocated {formatCents(summary.unallocated)}</span>
        </div>
      </section>

      {/* Tasks 7-10 fill these in: QuickSpend, BillsSection, BudgetSection,
          SubscriptionsSection, GoalsSection, SpendChart, PlanSection, Other */}
    </div>
  )
}
```

- [ ] **Step 6: Register the route.** In `src/App.jsx` add the import and route:

```jsx
import FinanceDashboard from './views/FinanceDashboard'
```

```jsx
          <Route path="/finance" element={<FinanceDashboard />} />
```

(next to the other dedicated routes, e.g. after `/area/:areaId`)

- [ ] **Step 7: Base CSS.** Append to `src/App.css`:

```css
/* ── Finance dashboard ─────────────────────────────── */
.fin-month {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin: 4px 0 12px; color: var(--text-primary); font-weight: 600;
}
.fin-month button { color: var(--text-secondary); display: grid; place-items: center; padding: 4px; }
.fin-section { padding: 14px; margin-bottom: 12px; }
.fin-section h3 {
  margin: 0 0 10px; font-size: 0.8rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary);
}
.fin-headline strong { font-size: 1.35rem; }
.fin-sub { color: var(--text-secondary); font-size: 0.85rem; }
.fin-track {
  height: 6px; border-radius: 3px; background: var(--surface-3);
  overflow: hidden; margin: 10px 0;
}
.fin-fill { height: 100%; background: var(--area-c1); border-radius: 3px; }
.fin-planline {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  color: var(--text-secondary); font-size: 0.8rem;
}
.fin-neg { color: var(--trim-r); }
.fin-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid var(--border);
}
.fin-row:last-child { border-bottom: none; }
.fin-row .fin-grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fin-amount { font-variant-numeric: tabular-nums; }
.fin-due { font-size: 0.8rem; color: var(--text-secondary); }
.fin-due.overdue { color: var(--trim-r); }
.fin-minibar { height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; margin-top: 4px; }
.fin-minibar > div { height: 100%; background: var(--area-c1); }
.fin-minibar > div.over { background: var(--trim-r); }
.fin-addrow { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.fin-addrow input { padding: 8px 10px; min-width: 0; }
.fin-addrow input.fin-amt { width: 84px; flex: none; }
.fin-addrow input.fin-title { flex: 2; min-width: 120px; }
.fin-addrow select {
  font: inherit; color: var(--text-primary); background: var(--surface-2);
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px;
}
.fin-addrow button.fin-add {
  padding: 8px 12px; border-radius: var(--radius-sm);
  background: var(--surface-3); color: var(--text-primary);
}
.fin-pay {
  padding: 5px 10px; border-radius: var(--radius-sm); font-size: 0.8rem;
  background: var(--surface-3); color: var(--text-primary); flex: none;
}
@media (min-width: 900px) {
  .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; align-items: start; }
  .fin-grid > .fin-col { min-width: 0; }
}
```

- [ ] **Step 8: Verify**

Run: `npx vitest run src/data/__tests__/areas.test.js src/lib/__tests__/finance.test.js` — PASS.
Run: `npm test` — all green.
Run: `npm run lint` — clean.
Run: `npm run build` — succeeds.

- [ ] **Step 9: Update CLAUDE.md.** In the AREA primitive paragraph, extend the kind union to `'list' | 'habits' | 'journal' | 'library' | 'timers' | 'money'` and the Finance bucket example to the new buckets. In the ITEM primitive paragraph, after the nudge-timer concession sentence, add:

```
   Finance (money) items additionally carry { amount, cadence, nextDue }
   and money LOGs carry { amount, note?, prevDue? } — the same deliberate
   concession, cents-integer amounts, no 5th primitive.
```

- [ ] **Step 10: Commit**

```bash
git add src/data/areas.js src/data/__tests__/areas.test.js src/App.jsx src/App.css src/views/FinanceDashboard.jsx src/lib/finance.js src/lib/__tests__/finance.test.js CLAUDE.md
git commit -m "feat(finance): money area kind, /finance route, dashboard skeleton"
```

---

### Task 7: Quick spend, budget table, and plan editor

**Files:**
- Create: `src/components/finance/QuickSpend.jsx`
- Create: `src/components/finance/BudgetSection.jsx`
- Create: `src/components/finance/PlanSection.jsx`
- Modify: `src/views/FinanceDashboard.jsx` (mount them)

**Interfaces:**
- Consumes: store actions `logSpend`, `addItem`; lib `monthActuals`; money `parseAmount`, `formatCents`.
- Produces: `<QuickSpend categories={items} />`, `<BudgetSection items={items} logs={logs} month={month} onEdit={setSheetItem} />`, `<PlanSection items={items} onEdit={setSheetItem} />`. `onEdit(item)` opens `ItemSheet` (wired in Task 9 — pass a no-op until then... no: wire the state + `ItemSheet` mount NOW with the stock sheet; Task 9 only extends the sheet's fields).

- [ ] **Step 1: QuickSpend.** Create `src/components/finance/QuickSpend.jsx`:

```jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import { parseAmount } from '../../lib/money'

/** The everyday surface: amount + category chip + optional memo. */
export default function QuickSpend({ categories }) {
  const logSpend = useStore((s) => s.logSpend)
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [catId, setCatId] = useState(null)

  const submit = () => {
    const cents = parseAmount(amountStr)
    if (cents == null) return
    logSpend(catId, cents, note)
    setAmountStr('')
    setNote('')
  }

  return (
    <section className="fin-section card">
      <h3>Log spending</h3>
      <div className="fin-addrow">
        <input
          className="fin-amt" inputMode="decimal" placeholder="0.00"
          value={amountStr} onChange={(e) => setAmountStr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          className="fin-title" placeholder="What for? (optional)"
          value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="fin-add" onClick={submit} aria-label="Log spend"><Plus size={16} /></button>
      </div>
      <div className="link-chips" style={{ marginTop: 8 }}>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip ${catId === c.id ? 'on' : ''}`}
            onClick={() => setCatId(catId === c.id ? null : c.id)}
          >
            {c.title}
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: BudgetSection.** Create `src/components/finance/BudgetSection.jsx`:

```jsx
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { monthActuals } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Per-category limit / spent / remaining with mini bars, plus inline add. */
export default function BudgetSection({ items, logs, month, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const categories = items.filter((i) => i.bucket === 'Spending')
  const { spendByCategory } = monthActuals(items, logs, month)

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Spending', amount: cents })
    setTitle('')
    setAmountStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Budget</h3>
      {categories.map((c) => {
        const spent = spendByCategory[c.id] ?? 0
        const limit = c.amount ?? 0
        const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
        return (
          <div key={c.id} className="fin-row" onClick={() => onEdit(c)} role="button" tabIndex={0}>
            <div className="fin-grow">
              {c.title}
              <div className="fin-minibar"><div className={spent > limit ? 'over' : ''} style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="fin-amount">
              {formatCents(spent)} <span className="fin-sub">/ {limit ? formatCents(limit) : 'set limit'}</span>
            </span>
          </div>
        )
      })}
      {spendByCategory.uncategorized > 0 && (
        <div className="fin-row">
          <div className="fin-grow fin-sub">Uncategorized</div>
          <span className="fin-amount">{formatCents(spendByCategory.uncategorized)}</span>
        </div>
      )}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New category" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="Limit" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: PlanSection.** Create `src/components/finance/PlanSection.jsx`:

```jsx
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { parseAmount, formatCents } from '../../lib/money'

/** Income rows and the savings allocation — the top of the budget math. */
export default function PlanSection({ items, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [planType, setPlanType] = useState('income')

  const plan = items.filter((i) => i.bucket === 'Plan')

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Plan', amount: cents, type: planType })
    setTitle('')
    setAmountStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Plan</h3>
      {plan.map((p) => (
        <div key={p.id} className="fin-row" onClick={() => onEdit(p)} role="button" tabIndex={0}>
          <div className="fin-grow">
            {p.title} <span className="fin-sub">{p.type === 'savings' ? 'savings' : 'income'}</span>
          </div>
          <span className="fin-amount">{formatCents(p.amount)}<span className="fin-sub">/mo</span></span>
        </div>
      ))}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="Salary, savings…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
          <option value="income">Income</option>
          <option value="savings">Savings</option>
        </select>
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Mount in the view.** In `src/views/FinanceDashboard.jsx`: add imports —

```jsx
import QuickSpend from '../components/finance/QuickSpend'
import BudgetSection from '../components/finance/BudgetSection'
import PlanSection from '../components/finance/PlanSection'
import ItemSheet from '../components/ItemSheet'
```

add sheet state after the `month` state —

```jsx
  const [sheetItem, setSheetItem] = useState(null)
```

replace the placeholder comment with —

```jsx
      <QuickSpend categories={items.filter((i) => i.bucket === 'Spending')} />
      <div className="fin-grid">
        <div className="fin-col">
          <BudgetSection items={items} logs={logs} month={month} onEdit={setSheetItem} />
        </div>
        <div className="fin-col">
          <PlanSection items={items} onEdit={setSheetItem} />
        </div>
      </div>
      {sheetItem && <ItemSheet item={sheetItem} onClose={() => setSheetItem(null)} />}
```

(ItemSheet works as-is today — title/details/bucket/notes/archive; Task 9 adds the money fields.)

- [ ] **Step 5: Verify + commit**

Run: `npm test` (all green), `npm run lint`, `npm run build`.
Manual check: `npm run dev`, open `http://localhost:5173/#/finance` — add an income row, a category with a limit, log a spend against it; the header numbers and mini bar move.

```bash
git add src/components/finance/QuickSpend.jsx src/components/finance/BudgetSection.jsx src/components/finance/PlanSection.jsx src/views/FinanceDashboard.jsx
git commit -m "feat(finance): quick spend, budget table, and plan sections"
```

---

### Task 8: Bills due and subscriptions

**Files:**
- Create: `src/components/finance/BillsSection.jsx`
- Create: `src/components/finance/SubscriptionsSection.jsx`
- Modify: `src/views/FinanceDashboard.jsx` (mount)

**Interfaces:**
- Consumes: `upcomingBills`, `subscriptionRollup`, `monthlyize` (lib); `payBill`, `addItem` (store); `parseAmount`, `formatCents` (money).
- Produces: `<BillsSection items={items} onEdit={setSheetItem} />` (bucket-aware add row: a `bucket` prop `'Bills' | 'Subscriptions'` is NOT needed — BillsSection owns Bills, SubscriptionsSection owns Subscriptions), `<SubscriptionsSection items={items} onEdit={setSheetItem} />`.

- [ ] **Step 1: BillsSection.** Create `src/components/finance/BillsSection.jsx`:

```jsx
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { upcomingBills } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'
import { todayKey } from '../../lib/rewards'

const dueLabel = (dateStr, overdue) => {
  const [, m, d] = dateStr.split('-').map(Number)
  const label = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`
  return overdue ? `${label} - overdue` : label
}

/** Everything due in the next 14 days (or overdue), with one-tap mark paid. */
export default function BillsSection({ items, onEdit }) {
  const payBill = useStore((s) => s.payBill)
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')
  const [payFor, setPayFor] = useState(null) // billId awaiting a manual amount
  const [payStr, setPayStr] = useState('')

  const due = upcomingBills(items, todayKey())
  const allBills = items.filter((i) => i.bucket === 'Bills')

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null || !nextDue) return
    addItem('finance', title, { bucket: 'Bills', amount: cents, cadence, nextDue })
    setTitle(''); setAmountStr(''); setNextDue('')
  }

  const pay = (bill) => {
    if (bill.amount != null) return payBill(bill.id)
    if (payFor !== bill.id) { setPayFor(bill.id); setPayStr(''); return }
    const cents = parseAmount(payStr)
    if (cents == null) return
    payBill(bill.id, cents)
    setPayFor(null)
  }

  return (
    <section className="fin-section card">
      <h3>Bills due</h3>
      {due.length === 0 && <div className="fin-sub">Nothing due in the next two weeks.</div>}
      {due.map((b) => (
        <div key={b.id} className="fin-row">
          <div className="fin-grow" onClick={() => onEdit(b)} role="button" tabIndex={0}>
            {b.title}
            <div className={`fin-due ${b.overdue ? 'overdue' : ''}`}>{dueLabel(b.nextDue, b.overdue)}</div>
          </div>
          <span className="fin-amount">{b.amount != null ? formatCents(b.amount) : ''}</span>
          {payFor === b.id && (
            <input
              className="fin-amt" inputMode="decimal" placeholder="0.00" autoFocus
              value={payStr} onChange={(e) => setPayStr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pay(b)}
            />
          )}
          <button className="fin-pay" onClick={() => pay(b)}>Paid</button>
        </div>
      ))}
      {allBills.length === 0 && due.length === 0 && <div className="fin-sub">Add your first bill below.</div>}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New bill" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="weekly">Weekly</option>
        </select>
        <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: SubscriptionsSection.** Create `src/components/finance/SubscriptionsSection.jsx`:

```jsx
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { subscriptionRollup, monthlyize } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Every subscription with its monthlyized cost, plus the total rollup. */
export default function SubscriptionsSection({ items, onEdit }) {
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cadence, setCadence] = useState('monthly')
  const [nextDue, setNextDue] = useState('')

  const subs = items.filter((i) => i.bucket === 'Subscriptions')
  const rollup = subscriptionRollup(items)

  const add = () => {
    const cents = parseAmount(amountStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, {
      bucket: 'Subscriptions', amount: cents, cadence,
      ...(nextDue && { nextDue }),
    })
    setTitle(''); setAmountStr(''); setNextDue('')
  }

  return (
    <section className="fin-section card">
      <h3>Subscriptions</h3>
      {subs.map((s) => (
        <div key={s.id} className="fin-row" onClick={() => onEdit(s)} role="button" tabIndex={0}>
          <div className="fin-grow">
            {s.title} <span className="fin-sub">{s.cadence === 'yearly' ? 'yearly' : s.cadence === 'weekly' ? 'weekly' : 'monthly'}</span>
          </div>
          <span className="fin-amount">{formatCents(monthlyize(s))}<span className="fin-sub">/mo</span></span>
        </div>
      ))}
      {subs.length > 0 && (
        <div className="fin-row">
          <div className="fin-grow"><strong>Total</strong></div>
          <span className="fin-amount">
            {formatCents(rollup.monthly)}<span className="fin-sub">/mo · {formatCents(rollup.yearly)}/yr</span>
          </span>
        </div>
      )}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New subscription" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="weekly">Weekly</option>
        </select>
        <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} title="Next renewal (optional)" />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Mount.** In `FinanceDashboard.jsx`, import both and place `<BillsSection items={items} onEdit={setSheetItem} />` directly after `<QuickSpend …/>` (before the `fin-grid`), and `<SubscriptionsSection items={items} onEdit={setSheetItem} />` inside the second `fin-col` above `<PlanSection …/>`.

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npm run lint`, `npm run build` — all green/clean.
Manual check (`npm run dev`): add a bill due within 14 days, mark it Paid — it re-sorts to next cycle and the payment shows in the month actuals; add a bill with no amount, Paid opens the inline amount input.

```bash
git add src/components/finance/BillsSection.jsx src/components/finance/SubscriptionsSection.jsx src/views/FinanceDashboard.jsx
git commit -m "feat(finance): bills-due list with mark paid, subscription rollup"
```

---

### Task 9: Savings goals, Other list, and money fields in ItemSheet

**Files:**
- Create: `src/components/finance/GoalsSection.jsx`
- Modify: `src/views/FinanceDashboard.jsx` (mount goals + Other)
- Modify: `src/components/ItemSheet.jsx` (money fields)

**Interfaces:**
- Consumes: `goalProgress` (lib); `contribute`, `addItem`, `updateItem` (store); `parseAmount`, `formatCents`, `centsToInput` (money); existing `ItemList` (`{ items, areaId, habitBucket }`).
- Produces: `<GoalsSection items={items} logs={logs} onEdit={setSheetItem} />`; ItemSheet renders Amount for every money-area item, Cadence + Next due for Bills/Subscriptions, and an Income/Savings selector for Plan items.

- [ ] **Step 1: GoalsSection.** Create `src/components/finance/GoalsSection.jsx`:

```jsx
import { useState } from 'react'
import { useStore } from '../../lib/store'
import { goalProgress } from '../../lib/finance'
import { parseAmount, formatCents } from '../../lib/money'

/** Savings goals: progress computed from contribution logs, never stored. */
export default function GoalsSection({ items, logs, onEdit }) {
  const contribute = useStore((s) => s.contribute)
  const addItem = useStore((s) => s.addItem)
  const [title, setTitle] = useState('')
  const [targetStr, setTargetStr] = useState('')
  const [contribFor, setContribFor] = useState(null)
  const [contribStr, setContribStr] = useState('')

  const goals = items.filter((i) => i.bucket === 'Goals')

  const add = () => {
    const cents = parseAmount(targetStr)
    if (!title.trim() || cents == null) return
    addItem('finance', title, { bucket: 'Goals', amount: cents })
    setTitle(''); setTargetStr('')
  }

  const addContribution = (goal) => {
    const cents = parseAmount(contribStr)
    if (cents == null) return
    contribute(goal.id, cents)
    setContribFor(null); setContribStr('')
  }

  return (
    <section className="fin-section card">
      <h3>Savings goals</h3>
      {goals.map((g) => {
        const saved = goalProgress(logs, g.id)
        const target = g.amount ?? 0
        const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0
        return (
          <div key={g.id} className="fin-row">
            <div className="fin-grow" onClick={() => onEdit(g)} role="button" tabIndex={0}>
              {g.title}
              <div className="fin-minibar"><div style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="fin-amount">
              {formatCents(saved)} <span className="fin-sub">/ {target ? formatCents(target) : 'set target'}</span>
            </span>
            {contribFor === g.id ? (
              <input
                className="fin-amt" inputMode="decimal" placeholder="0.00" autoFocus
                value={contribStr} onChange={(e) => setContribStr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContribution(g)}
              />
            ) : (
              <button className="fin-pay" onClick={() => { setContribFor(g.id); setContribStr('') }}>Add</button>
            )}
          </div>
        )
      })}
      <div className="fin-addrow">
        <input className="fin-title" placeholder="New goal" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="fin-amt" inputMode="decimal" placeholder="Target" value={targetStr} onChange={(e) => setTargetStr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="fin-add" onClick={add}>Add</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Mount goals + Other.** In `FinanceDashboard.jsx`: import `GoalsSection` and `ItemList` (`import ItemList from '../components/ItemList'`). Place `<GoalsSection items={items} logs={logs} onEdit={setSheetItem} />` in the first `fin-col` under `BudgetSection`, and after the `fin-grid` closing tag add the Other section with its own small add row:

```jsx
      <section className="fin-section card">
        <h3>Other</h3>
        <ItemList items={items.filter((i) => i.bucket === 'Other')} areaId="finance" />
        <div className="fin-addrow">
          <input
            className="fin-title" placeholder="Add a note-style item…"
            value={otherDraft} onChange={(e) => setOtherDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && otherDraft.trim()) {
                addItem('finance', otherDraft, { bucket: 'Other' })
                setOtherDraft('')
              }
            }}
          />
        </div>
      </section>
```

with `const addItem = useStore((s) => s.addItem)` and `const [otherDraft, setOtherDraft] = useState('')` added to the view.

- [ ] **Step 3: ItemSheet money fields.** In `src/components/ItemSheet.jsx`:

Add imports:

```jsx
import { parseAmount, centsToInput } from '../lib/money'
```

Add state + flags after the existing `useState` block (`area` is already in scope below — move the `const area = areaById(item.areaId)` line ABOVE the state block so the initializers can use it):

```jsx
  const money = area?.kind === 'money'
  const moneyBill = money && (item.bucket === 'Bills' || item.bucket === 'Subscriptions')
  const moneyPlan = money && item.bucket === 'Plan'
  const [amountStr, setAmountStr] = useState(item.amount != null ? centsToInput(item.amount) : '')
  const [cadence, setCadence] = useState(item.cadence ?? 'monthly')
  const [nextDue, setNextDue] = useState(item.nextDue ?? '')
  const [planType, setPlanType] = useState(item.type === 'savings' ? 'savings' : 'income')
```

Extend `save` to include the money patch (blank/invalid amount leaves the stored amount untouched):

```jsx
  const save = () => {
    const patch = { title: title.trim() || item.title, details }
    if (money) {
      const cents = parseAmount(amountStr)
      if (cents != null) patch.amount = cents
      if (moneyBill) {
        patch.cadence = cadence
        if (nextDue) patch.nextDue = nextDue
      }
      if (moneyPlan) patch.type = planType
    }
    updateItem(item.id, patch)
    onClose()
  }
```

Render the fields after the Details field:

```jsx
        {money && (
          <div className="field">
            <label>{item.bucket === 'Spending' ? 'Monthly limit' : item.bucket === 'Goals' ? 'Target' : 'Amount'}</label>
            <input inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          </div>
        )}
        {moneyBill && (
          <>
            <div className="field">
              <label>Cadence</label>
              <div className="link-chips">
                {['weekly', 'monthly', 'yearly'].map((c) => (
                  <button key={c} className={`chip ${cadence === c ? 'on' : ''}`} onClick={() => setCadence(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Next due</label>
              <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </>
        )}
        {moneyPlan && (
          <div className="field">
            <label>Counts as</label>
            <div className="link-chips">
              {['income', 'savings'].map((t) => (
                <button key={t} className={`chip ${planType === t ? 'on' : ''}`} onClick={() => setPlanType(t)}>{t}</button>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npm run lint`, `npm run build`.
Manual check: create a goal, contribute twice, progress bar reflects the sum; open a bill in the sheet, change its amount and due date, both stick; a non-finance item's sheet shows no money fields.

```bash
git add src/components/finance/GoalsSection.jsx src/views/FinanceDashboard.jsx src/components/ItemSheet.jsx
git commit -m "feat(finance): savings goals, other list, money fields in item sheet"
```

---

### Task 10: Spending history chart + final verification

**Files:**
- Create: `src/components/finance/SpendChart.jsx`
- Modify: `src/views/FinanceDashboard.jsx` (mount)
- Modify: `docs/superpowers/specs/2026-08-06-finance-dashboard-design.md` (status line → Implemented)

**Interfaces:**
- Consumes: `dailySpend`, `spendBars` (Task 3 — geometry already fully tested; the component only maps bars to `<rect>`s).
- Produces: `<SpendChart logs={logs} month={month} />`.

- [ ] **Step 1: SpendChart.** Create `src/components/finance/SpendChart.jsx`:

```jsx
import { dailySpend, spendBars } from '../../lib/finance'
import { formatCents } from '../../lib/money'

const W = 320
const H = 96

/**
 * Daily discretionary spend for the month. Geometry lives in
 * lib/finance.js (stackGeometry pattern); series-4 matches finance's
 * amber trim family without touching the validated palette.
 */
export default function SpendChart({ logs, month }) {
  const days = dailySpend(logs, month)
  const bars = spendBars(days, { width: W, height: H })
  const max = Math.max(...days)
  const total = days.reduce((s, v) => s + v, 0)

  return (
    <section className="fin-section card">
      <h3>Daily spending</h3>
      <div className="fin-sub" style={{ marginBottom: 6 }}>
        {formatCents(total)} this month{max > 0 ? ` · biggest day ${formatCents(max)}` : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Daily spending chart">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.w} height={b.h} rx="1" fill="var(--series-4)">
            <title>{`Day ${b.day}: ${formatCents(b.total)}`}</title>
          </rect>
        ))}
      </svg>
    </section>
  )
}
```

- [ ] **Step 2: Mount.** In `FinanceDashboard.jsx`, import `SpendChart` and place `<SpendChart logs={logs} month={month} />` in the first `fin-col`, under `GoalsSection`.

- [ ] **Step 3: Full verification pass**

- Run: `npm test` — entire suite green.
- Run: `npm run lint` — clean (pre-existing warnings unrelated to finance are acceptable; introduce none).
- Run: `npm run build` — succeeds.
- Manual sweep (`npm run dev`, `#/finance`): month prev/next changes every section's numbers; QuickSpend with and without a category; overdue bill renders red; mark-paid then delete-payment intent (via a temporary console call `useStore.getState().deleteMoneyLog(id)`) restores the due date; goals bar fills; chart bars appear on spend days; Other items check off and archive like any list item; sidebar's Finance entry now lands on the dashboard.

- [ ] **Step 4: Close out the spec.** In `docs/superpowers/specs/2026-08-06-finance-dashboard-design.md` change the Status line to `**Status:** Implemented (finance-dashboard branch)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/finance/SpendChart.jsx src/views/FinanceDashboard.jsx docs/superpowers/specs/2026-08-06-finance-dashboard-design.md
git commit -m "feat(finance): daily spending chart, spec closed out"
```

- [ ] **Step 6: Finish the branch** — invoke superpowers:finishing-a-development-branch (note: merging into `main` while `projects-delinearized` is unmerged is fine; the two touch different regions of `store.js` and `areas.test.js`, so the later merge will have at most trivial conflicts).

---

## Deferred (spec's out-of-scope list — do NOT build)

Bank/CSV import, multi-currency, QuickAdd parsing of "14.50 coffee", month-to-month budget rollover, due-bill notifications, and a spend-history *list* view (the log records carry everything needed; a per-category drill-down is clean v2 material).
