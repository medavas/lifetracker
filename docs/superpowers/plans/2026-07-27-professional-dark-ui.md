# Professional Dark UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle lifetracker into a professional, sleek, monochrome dark UI (box-shadow cards, six vibrant trim colors, lucide icons, zero emojis) with a desktop sidebar layout that collapses to the existing mobile bottom-nav experience.

**Architecture:** Token-level restyle — component JSX structure is preserved; `src/index.css` and `src/App.css` are rewritten; emojis are replaced by `lucide-react` icons resolved by name through a small `AreaIcon` component; a new `AppShell` adds the ≥900px sidebar via CSS grid/media query. Store, routing, server untouched.

**Tech Stack:** React 19, Vite 8, zustand, vitest, oxlint, pnpm. New dependency: `lucide-react` (only one).

**Spec:** `docs/superpowers/specs/2026-07-27-professional-dark-ui-design.md`

## Global Constraints

- No store, routing (HashRouter), server, rewards-logic, or PWA changes.
- The ONLY saturated colors in the UI are the six trims: `--trim-r #c53939`, `--trim-o #c77c35`, `--trim-y #d9b800`, `--trim-g #34aa48`, `--trim-b #3f48cc`, `--trim-v #a043a2`.
- Chart series tokens `--series-1..8` keep their exact current values (validated palette — do not touch).
- No gradients anywhere. No emojis anywhere in `src/` (vitest sweep enforces).
- Radii: `--radius: 8px`, `--radius-sm: 6px`.
- Breakpoint: 900px (sidebar on/bottom-nav off at ≥900px); area grid goes 4-col at ≥1200px.
- All commands run from the lifetracker repo root with `pnpm`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: lucide-react + area registry (trim + icon names)

**Files:**
- Modify: `package.json` (via `pnpm add lucide-react`)
- Modify: `src/data/areas.js`
- Test: `src/data/__tests__/areas.test.js` (new)

**Interfaces:**
- Produces: each entry in `AREAS` gains `trim: 'r'|'o'|'y'|'g'|'b'|'v'` and its `icon` field becomes a lucide component name string (e.g. `'Rocket'`). The `grad` field is DELETED. Later tasks style with `'--area-c1': \`var(--trim-${area.trim})\`` and render icons with `<AreaIcon name={area.icon} />`.

- [ ] **Step 1: Install lucide-react**

Run: `pnpm add lucide-react`
Expected: `lucide-react` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `src/data/__tests__/areas.test.js`:

```js
import { describe, it, expect } from 'vitest'
import * as lucide from 'lucide-react'
import { AREAS } from '../areas'

const EXPECTED = {
  projects: { trim: 'b', icon: 'Rocket' },
  finance: { trim: 'y', icon: 'Wallet' },
  budget: { trim: 'g', icon: 'ChartColumn' },
  work: { trim: 'o', icon: 'Briefcase' },
  fitness: { trim: 'r', icon: 'Dumbbell' },
  diet: { trim: 'g', icon: 'Salad' },
  health: { trim: 'r', icon: 'Stethoscope' },
  schedule: { trim: 'o', icon: 'CalendarDays' },
  habits: { trim: 'y', icon: 'KeyRound' },
  journal: { trim: 'v', icon: 'NotebookPen' },
  philosophy: { trim: 'v', icon: 'Landmark' },
  learnings: { trim: 'b', icon: 'Brain' },
}

describe('area registry', () => {
  it('has exactly the 12 known areas', () => {
    expect(AREAS.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it('maps each area to the spec trim and lucide icon name', () => {
    for (const a of AREAS) {
      expect({ id: a.id, trim: a.trim, icon: a.icon }).toEqual({ id: a.id, ...EXPECTED[a.id] })
    }
  })

  it('uses each trim color exactly twice', () => {
    const counts = {}
    for (const a of AREAS) counts[a.trim] = (counts[a.trim] || 0) + 1
    expect(counts).toEqual({ r: 2, o: 2, y: 2, g: 2, b: 2, v: 2 })
  })

  it('every icon name resolves to a lucide component', () => {
    for (const a of AREAS) expect(typeof lucide[a.icon]).not.toBe('undefined')
  })

  it('gradients are gone from the registry', () => {
    for (const a of AREAS) expect(a.grad).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `trim` is undefined, icons are emojis, `grad` still present.

- [ ] **Step 4: Update the registry**

In `src/data/areas.js`: for every entry, replace `icon: '<emoji>'` with the lucide name and `grad: [...]` with `trim: '<letter>'` per the EXPECTED table above. Also update the header comment (it currently documents `grad`). Example of the first two entries — apply the same shape to all 12:

```js
/**
 * Area registry — the single place a life-area is defined.
 * Adding an area = adding a row here. Every view is generic over this config.
 *
 * kind:
 *  - 'list'    → items (tasks/entries) with buckets
 *  - 'habits'  → recurring items with daily check-ins + streaks
 *  - 'journal' → dated notes
 *  - 'library' → items where each entry carries its own notes (books, videos…)
 *
 * `icon` is a lucide-react component name rendered via <AreaIcon>.
 * `trim` picks one of the six --trim-* tokens (theme in index.css); it is the
 * area's only color — a thin edge/tint, never a fill. Identity in the UI is
 * ALWAYS icon + name. Chart series colors (--series-*) are a separately
 * validated palette.
 */
export const AREAS = [
  {
    id: 'projects', name: 'Projects', icon: 'Rocket', kind: 'list',
    trim: 'b',
    keywords: ['project', 'build', 'ship', 'idea'],
    buckets: ['Active', 'Backlog', 'Someday'],
  },
  {
    id: 'finance', name: 'Finance', icon: 'Wallet', kind: 'list',
    trim: 'y',
    keywords: ['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay'],
    buckets: ['Bills', 'Insurance', 'Investments', 'Savings'],
  },
  // ...remaining 10 entries identical in shape, values from the EXPECTED table
]
```

Keep `keywords`, `buckets`, `name`, `kind`, `id` and the `areaById` export exactly as they are.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (all 5 registry tests; pre-existing smoke test still green).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/data/areas.js src/data/__tests__/areas.test.js
git commit -m "feat(ui): add lucide-react, replace area emoji/gradients with icon names + trims"
```

---

### Task 2: AreaIcon component

**Files:**
- Create: `src/components/AreaIcon.jsx`
- Test: `src/components/__tests__/AreaIcon.test.js` (new)

**Interfaces:**
- Consumes: lucide component names stored in `AREAS[n].icon` (Task 1).
- Produces: `AreaIcon({ name, size = 18, ...rest })` — renders the named lucide icon with `strokeWidth 1.75`, passing through `size` and any other props (e.g. `color`, `className`). Returns `null` for unknown names. All later tasks render icons ONLY through this component or direct lucide imports for fixed glyphs.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/AreaIcon.test.js` (component called as a plain function — no DOM needed):

```js
import { describe, it, expect } from 'vitest'
import { Rocket } from 'lucide-react'
import AreaIcon from '../AreaIcon'

describe('AreaIcon', () => {
  it('resolves a lucide icon by name with defaults', () => {
    const el = AreaIcon({ name: 'Rocket' })
    expect(el.type).toBe(Rocket)
    expect(el.props.size).toBe(18)
    expect(el.props.strokeWidth).toBe(1.75)
  })

  it('passes through size and extra props', () => {
    const el = AreaIcon({ name: 'Rocket', size: 13, color: 'var(--trim-b)' })
    expect(el.props.size).toBe(13)
    expect(el.props.color).toBe('var(--trim-b)')
  })

  it('returns null for unknown names', () => {
    expect(AreaIcon({ name: 'NotARealIcon' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — module `../AreaIcon` not found.

- [ ] **Step 3: Implement AreaIcon**

Create `src/components/AreaIcon.jsx`:

```jsx
import * as icons from 'lucide-react'

/** Renders a lucide icon by registry name (AREAS[n].icon). Null if unknown. */
export default function AreaIcon({ name, size = 18, ...rest }) {
  const Icon = icons[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.75} {...rest} />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AreaIcon.jsx src/components/__tests__/AreaIcon.test.js
git commit -m "feat(ui): AreaIcon resolves lucide icons from registry names"
```

---

### Task 3: Design tokens — rewrite `src/index.css`

**Files:**
- Modify: `src/index.css` (full replacement)

**Interfaces:**
- Produces: tokens used by every later task — `--bg`, `--surface-1/2/3`, `--border`, `--text-primary/secondary/muted`, `--trim-r/o/y/g/b/v`, `--shadow-card`, `--shadow-sheet`, `--radius: 8px`, `--radius-sm: 6px`, `--nav-h`, `--sidebar-w: 232px`. Tokens REMOVED: `--accent`, `--accent-soft`, `--gold`, `--good` (usages are replaced in Tasks 4–6).

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/index.css` with:

```css
/* ── Lifetracker theme ─────────────────────────────────────────
   Professional dark: monochrome neutral surfaces, shadow-elevated
   cards, color confined to six vibrant trims (Tactorius menu set).
   Chart series colors (--series-*) are a CVD-validated categorical
   palette (dark-mode steps) — do not eyeball-edit; revalidate if
   changed (dataviz validator).                                    */

:root {
  color-scheme: dark;

  --bg: #0b0c0e;
  --surface-1: #131418;
  --surface-2: #191a1f;
  --surface-3: #1f2026;
  --border: #26272d;

  --text-primary: #e8e9ec;
  --text-secondary: #9a9ca6;
  --text-muted: #63656e;

  /* Tactorius menu trims — the ONLY saturated color in the app */
  --trim-r: #c53939;
  --trim-o: #c77c35;
  --trim-y: #d9b800;
  --trim-g: #34aa48;
  --trim-b: #3f48cc;
  --trim-v: #a043a2;

  /* validated categorical series (dark) */
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --series-4: #c98500;
  --series-5: #d55181;
  --series-6: #008300;
  --series-7: #9085e9;
  --series-8: #e66767;

  /* elevation */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-sheet: 0 1px 2px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.35),
    0 12px 40px rgba(0, 0, 0, 0.5);

  --radius: 8px;
  --radius-sm: 6px;
  --nav-h: 64px;
  --sidebar-w: 232px;

  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text-primary);
  min-height: 100dvh;
}

body {
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}

#root { min-height: 100dvh; }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

input, textarea {
  font: inherit;
  color: var(--text-primary);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
}
input:focus, textarea:focus { border-color: var(--text-muted); }

::placeholder { color: var(--text-muted); }

a { color: inherit; text-decoration: none; }
```

Note the two structural changes vs. the old file: `#root` loses `max-width: 640px; margin: 0 auto;` (the `.content` wrapper in Task 5 takes that over), and focus styling is neutral instead of purple.

- [ ] **Step 2: Verify the app still builds**

Run: `pnpm build`
Expected: build succeeds (views still reference `--gold`/`--accent`/`grad` until Tasks 4–6 — unresolved CSS vars render as defaults, which is fine mid-flight; the BUILD must not error).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): monochrome dark tokens, trim palette, shadow elevation system"
```

---

### Task 4: Stylesheet — rewrite `src/App.css`

**Files:**
- Modify: `src/App.css` (full replacement)

**Interfaces:**
- Consumes: all tokens from Task 3.
- Produces: class contract used by Tasks 5–6. Unchanged class names: `.page`, `.page-head`, `.icon-chip`, `.back-btn`, `.section-label`, `.bottom-nav`, `.nav-ico`, `.nav-add`, `.card`, `.hero-card`, `.hero-meta`, `.tile-row`, `.stat-tile`, `.area-grid`, `.area-card`, `.a-icon`, `.a-name`, `.a-count`, `.item-list`, `.item-row`, `.check`, `.item-title`, `.drag-handle`, `.detail-btn`, `.bucket-tabs`, `.bucket-tab`, `.add-row`, `.empty-note`, `.habit-row`, `.streak`, `.habit-check`, `.journal-compose`, `.compose-foot`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.note-card`, `.note-date`, `.note-text`, `.link-chips`, `.chip`, `.sheet-backdrop`, `.sheet`, `.sheet-grab`, `.sheet-actions`, `.chart-wrap`, `.chart-tip`, `.data-toggle`, `.ring-wrap`, `.ring-label`, `.archived-toggle`. NEW classes: `.app-shell`, `.sidebar`, `.wordmark`, `.side-nav`, `.side-add`, `.side-foot`, `.side-level`, `.side-pts`, `.side-bar`, `.content`, `.dash-grid`, `.dash-main`, `.dash-side`. Per-area color arrives ONLY via the `--area-c1` custom property set inline by views.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/App.css` with:

```css
/* ── App shell ───────────────────────────────────────────── */
.content { max-width: 640px; margin: 0 auto; }

.sidebar {
  position: fixed; inset: 0 auto 0 0; width: var(--sidebar-w);
  display: none; flex-direction: column;
  background: var(--surface-1); border-right: 1px solid var(--border);
  padding: 20px 12px; z-index: 40;
}
.wordmark {
  font-size: 15px; font-weight: 700; letter-spacing: 0.01em;
  padding: 0 10px 18px;
}
.side-nav { display: flex; flex-direction: column; gap: 2px; }
.side-nav a {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500; color: var(--text-secondary);
}
.side-nav a:hover { color: var(--text-primary); }
.side-nav a.active { background: var(--surface-2); color: var(--text-primary); }
.side-add {
  margin-top: 14px; display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 9px 10px; border-radius: var(--radius-sm);
  background: var(--text-primary); color: var(--bg);
  font-size: 14px; font-weight: 600;
}
.side-foot { margin-top: auto; padding: 0 10px 6px; }
.side-level { font-size: 13px; font-weight: 600; }
.side-pts { font-size: 12px; color: var(--text-muted); margin: 2px 0 8px; }
.side-bar { height: 3px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.side-bar span { display: block; height: 100%; background: var(--trim-y); }

/* ── Layout ──────────────────────────────────────────────── */
.page {
  padding: 20px 16px calc(var(--nav-h) + 32px);
  animation: fade-in 0.18s ease;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-head h1 { font-size: 20px; font-weight: 600; margin: 0; flex: 1; letter-spacing: -0.01em; }
.page-head .icon-chip {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  display: grid; place-items: center; flex: none;
  background: var(--surface-2); border: 1px solid var(--border);
  color: var(--area-c1, var(--text-secondary));
}
.back-btn {
  display: flex; align-items: center; gap: 2px;
  color: var(--text-secondary); font-size: 14px; padding: 6px 8px 6px 0;
}

.section-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-muted); margin: 20px 0 8px;
}

/* ── Bottom nav (mobile) ─────────────────────────────────── */
.bottom-nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 640px; height: calc(var(--nav-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: rgba(11, 12, 14, 0.92);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--border);
  z-index: 40;
}
.bottom-nav a, .bottom-nav button {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; font-size: 10.5px; color: var(--text-muted); font-weight: 600;
}
.bottom-nav a.active { color: var(--text-primary); }
.nav-add {
  align-self: center; justify-self: center;
  width: 44px; height: 44px; border-radius: var(--radius);
  background: var(--text-primary);
  color: var(--bg) !important;
  display: grid !important; place-items: center;
  box-shadow: var(--shadow-card);
}

/* ── Cards & tiles ───────────────────────────────────────── */
.card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.hero-card { display: flex; align-items: center; gap: 16px; }
.hero-meta { flex: 1; min-width: 0; }
.hero-meta .greet { color: var(--text-secondary); font-size: 13px; margin: 0 0 2px; }
.hero-meta .level { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.hero-meta .pts { color: var(--text-secondary); font-size: 13px; margin: 4px 0 0; }
.hero-meta .pts b { color: var(--trim-y); }

.tile-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.stat-tile { padding: 14px; }
.stat-tile .stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.stat-tile .stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* ── Dashboard columns ───────────────────────────────────── */
.dash-grid { display: block; }

/* ── Area grid ───────────────────────────────────────────── */
.area-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.area-card {
  padding: 14px; min-height: 92px;
  display: flex; flex-direction: column; justify-content: space-between;
  border-left: 3px solid var(--area-c1, var(--border));
  transition: transform 0.1s ease;
}
.area-card:active { transform: scale(0.98); }
.area-card .a-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: grid; place-items: center; flex: none;
  background: var(--surface-2); border: 1px solid var(--border);
  color: var(--area-c1, var(--text-secondary));
}
.area-card .a-name { font-weight: 600; font-size: 14px; margin-top: 10px; }
.area-card .a-count { font-size: 12px; color: var(--text-secondary); }

/* ── Item list ───────────────────────────────────────────── */
.item-list { display: flex; flex-direction: column; gap: 8px; }
.item-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface-1); border: 1px solid var(--border);
  border-left: 3px solid var(--area-c1, var(--border));
  border-radius: var(--radius-sm); padding: 10px 12px;
  box-shadow: var(--shadow-card);
  touch-action: manipulation;
}
.item-row.dragging { opacity: 0.6; border-color: var(--text-muted); }
.item-row.done .item-title { color: var(--text-muted); text-decoration: line-through; }

.check {
  width: 22px; height: 22px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--text-muted);
  flex: none; display: grid; place-items: center; color: transparent;
  transition: all 0.12s ease;
}
.check.on { background: var(--text-primary); border-color: var(--text-primary); color: var(--bg); }

.item-title { flex: 1; min-width: 0; font-size: 15px; overflow-wrap: anywhere; }
.item-title input {
  width: 100%; background: transparent; border: none; padding: 0; font-size: 15px;
}
.drag-handle { color: var(--text-muted); padding: 4px; cursor: grab; touch-action: none; display: grid; place-items: center; }
.detail-btn { color: var(--text-muted); padding: 4px 2px; display: grid; place-items: center; }

.bucket-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; scrollbar-width: none; }
.bucket-tabs::-webkit-scrollbar { display: none; }
.bucket-tab {
  flex: none; padding: 7px 14px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600;
  background: var(--surface-2); color: var(--text-secondary); border: 1px solid var(--border);
}
.bucket-tab.on {
  background: var(--surface-3); color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--area-c1, var(--text-primary));
}

.add-row { display: flex; gap: 8px; margin-top: 12px; }
.add-row input { flex: 1; padding: 11px 14px; font-size: 15px; }
.add-row button {
  flex: none; width: 44px; border-radius: var(--radius-sm);
  display: grid; place-items: center;
  background: var(--text-primary); color: var(--bg);
}

.empty-note { color: var(--text-muted); font-size: 14px; text-align: center; padding: 28px 0; }

/* ── Habits ──────────────────────────────────────────────── */
.habit-row { display: flex; align-items: center; gap: 12px; }
.habit-row .streak { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.habit-row .streak b { color: var(--trim-y); }
.habit-check {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--text-muted);
  display: grid; place-items: center; color: transparent; flex: none;
  transition: all 0.15s ease;
}
.habit-check.on { background: var(--text-primary); border-color: var(--text-primary); color: var(--bg); }

/* ── Journal ─────────────────────────────────────────────── */
.journal-compose textarea {
  width: 100%; min-height: 88px; padding: 12px 14px; font-size: 15px; resize: vertical;
}
.compose-foot { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.compose-foot .hint { flex: 1; font-size: 12px; color: var(--text-muted); }
.btn-primary {
  background: var(--text-primary); color: var(--bg); font-weight: 600; font-size: 14px;
  padding: 10px 18px; border-radius: var(--radius-sm);
}
.note-card { margin-top: 10px; }
.note-card .note-date { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.note-card .note-text { font-size: 15px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.link-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: var(--radius-sm);
  background: var(--surface-2); border: 1px solid var(--border); color: var(--text-secondary);
}
.chip.on { border-color: var(--text-secondary); color: var(--text-primary); background: var(--surface-3); }

/* ── Sheet (details / quick add) ─────────────────────────── */
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(4, 5, 7, 0.6); z-index: 50;
  animation: fade-in 0.15s ease;
}
.sheet {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 640px; z-index: 51;
  background: var(--surface-2); border-radius: 12px 12px 0 0;
  border: 1px solid var(--border); border-bottom: none;
  box-shadow: var(--shadow-sheet);
  padding: 10px 16px calc(20px + env(safe-area-inset-bottom));
  animation: sheet-up 0.2s ease;
  max-height: 86dvh; overflow-y: auto;
}
@keyframes sheet-up { from { transform: translate(-50%, 24px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
.sheet-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 14px; }
.sheet h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin: 0 0 12px; }
.sheet .field { margin-bottom: 12px; }
.sheet .field label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.07em; }
.sheet .field input, .sheet .field textarea { width: 100%; padding: 10px 12px; }
.sheet-actions { display: flex; gap: 8px; margin-top: 16px; }
.sheet-actions .btn-primary { flex: 1; text-align: center; }
.btn-ghost {
  padding: 10px 14px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600;
  color: var(--text-secondary); border: 1px solid var(--border);
}
.btn-danger { color: var(--trim-r); border-color: var(--trim-r); }

/* ── Chart ───────────────────────────────────────────────── */
.chart-wrap { position: relative; }
.chart-tip {
  position: absolute; pointer-events: none; z-index: 5;
  background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  padding: 6px 10px; font-size: 12px; white-space: nowrap;
  transform: translate(-50%, -110%);
}
.chart-tip b { display: block; font-size: 13px; }
.data-toggle { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.data-toggle summary { cursor: pointer; }
.data-toggle table { width: 100%; border-collapse: collapse; margin-top: 6px; }
.data-toggle td, .data-toggle th { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--border); font-size: 12px; }

/* ── Progress ring ───────────────────────────────────────── */
.ring-wrap { position: relative; width: 84px; height: 84px; flex: none; }
.ring-wrap .ring-label {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 17px; font-weight: 700;
}

.archived-toggle { font-size: 13px; color: var(--text-muted); margin-top: 16px; text-align: center; width: 100%; }

/* ── Desktop (≥900px): sidebar on, bottom nav off ────────── */
@media (min-width: 900px) {
  .sidebar { display: flex; }
  .bottom-nav { display: none; }
  .content { margin-left: var(--sidebar-w); max-width: none; }
  .page { max-width: 1100px; margin: 0 auto; padding: 28px 32px 48px; }
  .tile-row { grid-template-columns: repeat(4, 1fr); }
  .area-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .dash-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
  .dash-side .section-label:first-child { margin-top: 0; }
}
@media (min-width: 1200px) {
  .area-grid { grid-template-columns: repeat(4, 1fr); }
}
```

Deliberate deletions vs. the old file: the `.hero-card` gradient, `.nav-add` purple gradient circle, `.area-card::after` colored bubble, `.habit-check.on` gold gradient, every `--accent`/`--gold`/`--area-soft` reference, and the old `.bottom-nav .nav-ico` font-size rule (icons are now sized via the lucide `size` prop).

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(ui): shadow-elevated monochrome stylesheet + desktop sidebar layout rules"
```

---

### Task 5: AppShell, sidebar, re-iconed BottomNav, dashboard columns

**Files:**
- Create: `src/components/AppShell.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/BottomNav.jsx` (full replacement)
- Modify: `src/views/Dashboard.jsx` (layout wrapper only — emoji work happens in Task 6)

**Interfaces:**
- Consumes: `.app-shell`/`.sidebar`/`.content`/`.dash-grid` CSS (Task 4); `levelForPoints`, `levelProgress` from `src/lib/rewards.js`; `useStore` points.
- Produces: `AppShell({ onAdd, children })` — sidebar (desktop) + `.content` wrapper. `BottomNav({ onAdd })` keeps its exact prop signature. Dashboard sections split into `.dash-main` / `.dash-side` inside `.dash-grid`.

- [ ] **Step 1: Create AppShell**

Create `src/components/AppShell.jsx`:

```jsx
import { NavLink } from 'react-router-dom'
import { House, LayoutGrid, KeyRound, NotebookPen, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { levelForPoints, levelProgress } from '../lib/rewards'

/**
 * Desktop shell: fixed left sidebar (≥900px, CSS-controlled) + content column.
 * On mobile the sidebar is display:none and BottomNav (rendered by App) takes over.
 */
export default function AppShell({ onAdd, children }) {
  const points = useStore((s) => s.points)
  const level = levelForPoints(points)
  const progress = levelProgress(points)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">Lifetracker</div>
        <nav className="side-nav">
          <NavLink to="/" end><House size={17} strokeWidth={1.75} />Home</NavLink>
          <NavLink to="/areas"><LayoutGrid size={17} strokeWidth={1.75} />Areas</NavLink>
          <NavLink to="/habits"><KeyRound size={17} strokeWidth={1.75} />Habits</NavLink>
          <NavLink to="/journal"><NotebookPen size={17} strokeWidth={1.75} />Journal</NavLink>
        </nav>
        <button className="side-add" onClick={onAdd}>
          <Plus size={16} strokeWidth={2} />Quick add
        </button>
        <div className="side-foot">
          <div className="side-level">Level {level}</div>
          <div className="side-pts">{points} pts · {Math.round(progress * 100)}% to L{level + 1}</div>
          <div className="side-bar"><span style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Wire AppShell into App.jsx**

In `src/App.jsx`, import AppShell and wrap the routes (BottomNav and QuickAdd stay where they are):

```jsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import AppShell from './components/AppShell'
import BottomNav from './components/BottomNav'
import QuickAdd from './components/QuickAdd'
import Dashboard from './views/Dashboard'
import AreasGrid from './views/AreasGrid'
import AreaView from './views/AreaView'
import Journal from './views/Journal'
import Habits from './views/Habits'
import './App.css'

/**
 * HashRouter on purpose: works identically as a static file, a PWA on the
 * phone home screen, and behind any host without server rewrite rules.
 * Swap to BrowserRouter when the rdeyo deploy has a real server.
 */
export default function App() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <HashRouter>
      <AppShell onAdd={() => setQuickAddOpen(true)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/areas" element={<AreasGrid />} />
          <Route path="/area/:areaId" element={<AreaView />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/habits" element={<Habits />} />
        </Routes>
      </AppShell>
      <BottomNav onAdd={() => setQuickAddOpen(true)} />
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </HashRouter>
  )
}
```

- [ ] **Step 3: Replace BottomNav with lucide icons**

Replace the entire contents of `src/components/BottomNav.jsx` with:

```jsx
import { NavLink } from 'react-router-dom'
import { House, LayoutGrid, KeyRound, NotebookPen, Plus } from 'lucide-react'

export default function BottomNav({ onAdd }) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <House size={20} strokeWidth={1.75} />Home
      </NavLink>
      <NavLink to="/areas">
        <LayoutGrid size={20} strokeWidth={1.75} />Areas
      </NavLink>
      <button className="nav-add" onClick={onAdd} aria-label="Quick add">
        <Plus size={22} strokeWidth={2} />
      </button>
      <NavLink to="/habits">
        <KeyRound size={20} strokeWidth={1.75} />Habits
      </NavLink>
      <NavLink to="/journal">
        <NotebookPen size={20} strokeWidth={1.75} />Journal
      </NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Split Dashboard into main/side columns**

In `src/views/Dashboard.jsx`, wrap the existing sections (leave their internals alone — Task 6 handles glyphs): directly inside `<div className="page">`, add `<div className="dash-grid">`; put the hero card, tile-row, keystones section, and Last-7-days chart inside `<div className="dash-main">`; put the latest-journal section and thought-of-the-day block inside `<div className="dash-side">`; close both plus `dash-grid`. The JSX section order stays hero → tiles → keystones → chart → journal → quote.

- [ ] **Step 5: Verify — tests, build, and both viewports**

Run: `pnpm test` then `pnpm build`
Expected: both pass.
Run: `pnpm dev`, open the printed URL in a browser at full width — sidebar visible with icons + level block, no bottom nav, dashboard two-column. Narrow to <900px — bottom nav returns with lucide icons, single column, sidebar gone.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppShell.jsx src/App.jsx src/components/BottomNav.jsx src/views/Dashboard.jsx
git commit -m "feat(ui): desktop sidebar shell, lucide bottom nav, two-column dashboard"
```

---

### Task 6: Emoji/glyph purge across all views and components

**Files:**
- Test: `src/lib/__tests__/no-emoji.test.js` (new)
- Modify: `src/views/Dashboard.jsx`, `src/views/AreasGrid.jsx`, `src/views/AreaView.jsx`, `src/views/Habits.jsx`, `src/views/Journal.jsx`, `src/components/QuickAdd.jsx`, `src/components/ItemSheet.jsx`, `src/components/ItemList.jsx`, `src/components/ProgressRing.jsx`
- Check (likely no change): `index.html`

**Interfaces:**
- Consumes: `AreaIcon` (Task 2), `AREAS[n].trim` (Task 1), trim tokens (Task 3).
- Produces: zero emoji/dingbat glyphs anywhere in `src/`, enforced by test.

- [ ] **Step 1: Write the failing sweep test**

Create `src/lib/__tests__/no-emoji.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Emoji blocks, dingbats (✓ ✔), variation selector, arrows (← →), misc pictographs.
const BANNED = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const SRC = fileURLToPath(new URL('../../', import.meta.url))

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__tests__' || e.name === 'node_modules') return []
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.(jsx?|css|html)$/.test(e.name) ? [p] : []
  })
}

describe('professional UI', () => {
  it('contains no emoji or dingbat glyphs in src/', () => {
    const offenders = []
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8')
      const m = text.match(BANNED)
      if (m) offenders.push(`${file} → "${m[0]}"`)
    }
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, listing every file that still carries emojis/glyphs (Dashboard, AreasGrid, AreaView, Habits, Journal, QuickAdd, ItemSheet, ItemList at minimum).

- [ ] **Step 3: Purge Dashboard.jsx**

- `{bestStreak}🔥` → `{bestStreak}` and its label `best streak` → `best streak (days)`.
- Habit check button content `✓` → `<Check size={15} strokeWidth={2.5} />` (import `Check` from `lucide-react`).
- Section label `{area.icon} Thought of the day` → `Thought of the day`.
- Curly quotes around the quote text (`“…”`) are fine — they are typographic, not emoji; leave them.

- [ ] **Step 4: Purge AreasGrid.jsx**

Replace the card body (imports: add `AreaIcon` from `../components/AreaIcon`):

```jsx
<div className="card area-card" style={{ '--area-c1': `var(--trim-${a.trim})` }}>
  <div className="a-icon"><AreaIcon name={a.icon} /></div>
  <div>
    <div className="a-name">{a.name}</div>
    <div className="a-count">
      {countFor(a)} {a.kind === 'journal' ? 'entries' : 'open'}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Purge AreaView.jsx**

- Page style: `style={{ '--area-c1': \`var(--trim-${area.trim})\` }}` (drop `--area-soft`).
- Back button: `‹ Back` → `<ChevronLeft size={16} strokeWidth={1.75} />Back` (import `ChevronLeft` from `lucide-react`).
- Icon chip: `<div className="icon-chip"><AreaIcon name={area.icon} /></div>` (no inline gradient style).
- Add button label `+` → `<Plus size={20} strokeWidth={2} />` (import `Plus`).
- Archived toggle text `'← Back to active'` → `'Back to active'`.

- [ ] **Step 6: Purge Habits.jsx**

- Page style `{{ '--area-c1': '#f59f00' }}` → `{{ '--area-c1': 'var(--trim-y)' }}`.
- Icon chip: `<div className="icon-chip"><AreaIcon name="KeyRound" /></div>` (import `AreaIcon`; drop inline gradient).
- Check button `✓` → `<Check size={16} strokeWidth={2.5} />`.
- 7-day dot fill `'var(--gold)'` → `'var(--trim-y)'`.
- Streak `<b>{streak}</b>🔥` → `<Flame size={13} strokeWidth={1.75} /><b>{streak}</b>` (import `Flame`).
- Detail button `›` → `<ChevronRight size={17} strokeWidth={1.75} />` (import `ChevronRight`).
- Add button `+` → `<Plus size={20} strokeWidth={2} />`.

- [ ] **Step 7: Purge Journal.jsx and QuickAdd.jsx chips**

Both render area chips as `+ {a.icon} {a.name}` / `{a.icon} {a.name}`. Replace with (import `AreaIcon` in each):

```jsx
<button key={a.id} className={/* unchanged */} onClick={/* unchanged */}>
  <AreaIcon name={a.icon} size={13} /> {a.name}
</button>
```

(The leading `+ ` in Journal's chips is dropped.) In QuickAdd also keep the curly-quote placeholder text — typographic, allowed.

- [ ] **Step 8: Purge ItemSheet.jsx and ItemList.jsx**

ItemSheet: `<h2>{area?.icon} {area?.name}</h2>` → `<h2><AreaIcon name={area?.icon} size={16} /> {area?.name}</h2>` (import `AreaIcon`); note-add button `+` → `<Plus size={18} strokeWidth={2} />`.
ItemList SortableRow (import `Check`, `ChevronRight`, `GripVertical` from `lucide-react`): check `✓` → `<Check size={14} strokeWidth={2.5} />`; detail `›` → `<ChevronRight size={17} strokeWidth={1.75} />`; drag handle `⋮⋮` → `<GripVertical size={15} strokeWidth={1.75} />`.

- [ ] **Step 9: ProgressRing default color + check index.html**

In `src/components/ProgressRing.jsx`, change the default: `color = 'var(--gold)'` → `color = 'var(--trim-y)'`.
Open `index.html`; if it contains emojis (e.g. in title), remove them. If clean, no change.

- [ ] **Step 10: Run sweep + full suite to verify green**

Run: `pnpm test`
Expected: PASS — no-emoji sweep, registry, AreaIcon, smoke all green.
Run: `pnpm lint`
Expected: clean (no new warnings from the touched files).

- [ ] **Step 11: Commit**

```bash
git add src/views src/components index.html
git commit -m "feat(ui): replace all emoji glyphs with lucide icons, trim-token colors"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full gates**

Run: `pnpm test` → all green. `pnpm lint` → clean. `pnpm build` → succeeds.

- [ ] **Step 2: Visual check, desktop**

Run: `pnpm dev`. At full width verify: sidebar with wordmark/nav/Quick add/level block; cards visibly shadow-elevated on the darker page bg; dashboard two-column; areas page 3–4 columns with per-area colored left edges and tinted lucide icons; an area page shows squared bucket tabs with colored underline on the active tab; no gradients, no purple, no emojis anywhere; Quick add opens from the sidebar button.

- [ ] **Step 3: Visual check, mobile (390px)**

Devtools responsive mode at 390px: bottom nav with lucide icons and squared neutral + button; single column everywhere; sheets (item details, quick add) still slide up and look right; habit checks toggle.

- [ ] **Step 4: Report**

No commit. Report the verification results (including anything that looks off) back for review — screenshots or a short pass/fail list per check.
