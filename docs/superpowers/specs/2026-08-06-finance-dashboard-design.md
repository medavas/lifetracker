# Finance Dashboard — Design

**Date:** 2026-08-06
**Status:** Approved, not implemented

Finance stops being a generic bucketed list and becomes a real dashboard:
design a monthly budget, log daily spending, track subscriptions, savings
goals, and recurring bills — one page, not tabs.

## Decisions (settled with Ryan)

1. **Spend entry:** log each expense (amount + category + optional memo).
2. **Budget model:** full monthly plan — income − bills/subs − savings
   allocation → per-category spending limits; dashboard shows plan vs. actual.
3. **Bills/subscriptions:** amount + cadence + next due date; mark-paid
   records the payment into the month's actuals and auto-advances the due
   date one cycle. Subscriptions get a monthly/annual cost rollup.
4. **Savings goals:** target amount + dated contribution logs; progress is
   computed from logs, never stored.
5. **Old Finance area:** the dashboard replaces `/area/finance`. Old buckets
   are remapped (see Migration); an "Other" section keeps a home for
   Insurance/Investments-style list items.
6. **Architecture:** new area kind `'money'` — CLAUDE.md's first-preference
   mechanism (a new area kind with its own view, exactly like Journal,
   Habits, and Nudges). No 5th primitive.

## Data model — no new primitives

### AREA (`src/data/areas.js`)

Finance row becomes:

```js
{
  id: 'finance', name: 'Finance', icon: 'Wallet', kind: 'money',
  route: '/finance', trim: 'y',
  keywords: [...existing, 'subscription'],
  buckets: ['Plan', 'Bills', 'Subscriptions', 'Spending', 'Goals', 'Other'],
}
```

Buckets carry role meaning (the `habitBucket` precedent — bucket drives
behavior, no new ITEM discriminator field):

| Bucket | Holds | ITEM fields used |
|---|---|---|
| Plan | Income item(s) + one Savings-allocation item | `amount` |
| Bills | Recurring bills (rent, utilities, insurance premiums) | `amount`, `cadence`, `nextDue` |
| Subscriptions | Same shape as Bills, presented with rollup | `amount`, `cadence`, `nextDue` |
| Spending | Discretionary categories; `amount` = monthly limit | `amount` |
| Goals | Savings goals; `amount` = target | `amount` |
| Other | Plain list items — behaves like today's list | none |

### ITEM — three optional fields

Whitelisted in `addItem`/`updateItem` the same way nudges' `intervalMin` is
(the sanctioned two-scalar-concession pattern; sync passes them through
with zero server change):

- `amount` — integer **cents** (avoids float drift; formatted at the edge)
- `cadence` — `'weekly' | 'monthly' | 'yearly'`
- `nextDue` — `'YYYY-MM-DD'`

### LOG — one amount, one memo, three new kinds

- `amount` — integer cents
- `note` — optional short memo on spends ("coffee")
- new `kind` values: `'spend'` (itemId = Spending category),
  `'bill-pay'` (itemId = bill/subscription), `'contribute'` (itemId = goal)

Money logs award **0 reward points**. The points economy is untouched.

## Store actions (`src/lib/store.js`)

- `logSpend(categoryId, amountCents, note?, date?)`
- `payBill(billId, amountCents?, date?)` — defaults to the bill's `amount`;
  creates the `'bill-pay'` log and advances `nextDue` one cadence.
  Month-end clamp: due Jan 31 + monthly → Feb 28 (last day of month).
- `contribute(goalId, amountCents, date?)`
- Deleting a `'bill-pay'` log steps the bill's `nextDue` **back** one
  cadence — mark-paid is fully reversible, matching the app's
  uncheck-takes-back-exactly rule.

All deletes remain tombstones (`deletedAt`), never splices.

## Pure math (`src/lib/finance.js`, new)

House pattern: all computation in a pure, unit-tested module; components
only render. Functions:

- `monthlyize(item)` — yearly/12, weekly×52/12, monthly as-is
- `monthActuals(logs, items, 'YYYY-MM')` — spend totals per category,
  bill payments, contributions for the month
- `budgetSummary(items, logs, month)` — income, fixed (bills+subs
  monthlyized), savings allocation, Σ category limits, **unallocated**
  remainder, spent vs. planned discretionary
- `upcomingBills(items, today, horizonDays = 14)` — sorted, overdue flagged
- `goalProgress(logs, goalId)` — Σ contributions vs. target
- `subscriptionRollup(items)` — total $/mo and $/yr
- `advanceDue(dateStr, cadence, direction)` — shared by pay/un-pay

Currency parse/format in `src/lib/money.js` (cents ↔ display; positive
amounts only, two-decimal validation at input edge). USD only — no
currency field (YAGNI).

## Dashboard view (`src/views/FinanceDashboard.jsx` at `/finance`)

Single-column mobile-first; two-column grid on desktop. Order:

1. **Month header** — prev/next month picker; headline "spent $X of $Y
   discretionary", progress bar, days left in month, unallocated amount.
2. **Quick spend** — amount input + category chips + optional memo.
   The everyday surface; sits on top.
3. **Upcoming bills** — next 14 days plus overdue (highlighted), amount +
   mark-paid button each.
4. **Budget** — per-category limit / spent / remaining with mini bars;
   fixed-costs summary row.
5. **Subscriptions** — list + "$X/mo · $Y/yr" rollup.
6. **Savings goals** — progress bars + contribute button.
7. **Spending history** — daily-spend SVG bar chart for the selected month;
   geometry math extracted pure (the `DailyStack`/`chart.js` pattern),
   colors from the validated `--series` tokens only.
8. **Other** — existing `ItemList` reused for the Other bucket.

Add/edit for bills, subscriptions, categories, and goals reuses
`ItemSheet`, extended to conditionally render amount/cadence/due-date
fields when the item's area kind is `'money'`. Plain global CSS with
existing tokens; finance keeps trim `y`. Items missing an `amount` show a
"set amount" affordance instead of breaking the math (treated as 0).

Navigation: registry-driven sidebar/bottom-nav pick up the new route
automatically via `routeFor`; no nav component changes.

## Migration

Zustand persist `version` bumps 2 → 3 with a real migrate (replacing the
identity migrate) that remaps old finance buckets:

| Old | New |
|---|---|
| Bills, Fixed | Bills |
| Variable | Spending |
| Savings, Goals | Goals |
| Insurance, Investments | Other |

Remapped items get fresh `updatedAt` so the change syncs to other devices
through the normal last-write-wins path. Old items have no `amount` —
they surface with the "set amount" affordance.

## Error handling

- Amount inputs: reject non-positive / non-numeric; parse to cents at the
  edge, never store floats.
- `payBill` on a bill with no `amount` and no override: prompt for the
  amount (the log must carry one).
- Deleting a bill or category with existing logs: the logs remain (money
  actually left the account). Month math groups logs whose item no longer
  resolves under an "Uncategorized" row so totals stay truthful. Archive
  remains the encouraged path, matching app convention.

## Testing

- `src/lib/finance.js` — full unit coverage: monthlyize, budget summary,
  unallocated math, due-date advance/retreat incl. month-end clamping
  (Jan 31 → Feb 28 → Mar 31 round-trip), goal progress, rollups.
- Store: `payBill` advances `nextDue`; deleting the payment log retreats
  it; `logSpend`/`contribute` create correct log shapes; money logs award
  0 points.
- Migration: bucket remap, `updatedAt` refresh, non-finance items
  untouched.
- Registry invariants (`src/data/__tests__/areas.test.js`) updated:
  finance kind/route/buckets/keywords; finance joins the routed-areas
  set; `'money'` joins the documented kind list.

## Out of scope (deliberate)

- Bank/CSV import, multi-currency
- Global QuickAdd parsing of "14.50 coffee" (dashboard quick-spend covers
  daily entry; QuickAdd money parsing is a clean v2)
- Budget rollover between months
- Due-bill notifications (Nudges already exists if wanted later)
