# Professional Dark UI Restyle — Design

**Date:** 2026-07-27
**Status:** Approved
**Scope:** Visual restyle only — no store, routing, or server changes.

## Goal

Replace the current bubbly, emoji-heavy mobile UI with a professional, sleek
dark UI: monochrome surfaces, box-shadow elevation on card areas, vibrant color
reduced to thin trims. Add a real desktop layout (left sidebar) while keeping
the existing mobile bottom-nav experience.

## Approach

Token-level restyle. Keep every component and its JSX structure; rewrite the
CSS tokens (`src/index.css`) and stylesheet (`src/App.css`), add one dependency
(`lucide-react`), and add a responsive `AppShell` with a desktop sidebar.

Rejected alternatives: adopting a component library (Radix/shadcn — big
dependency and pattern shift for a 12-file app); per-component CSS-module
rewrite (churn, no visual gain).

## Design tokens (`src/index.css`)

Neutral (un-blued) dark scale:

| Token | Value |
|---|---|
| `--bg` | `#0b0c0e` |
| `--surface-1` | `#131418` |
| `--surface-2` | `#191a1f` |
| `--surface-3` | `#1f2026` |
| `--border` | `#26272d` |
| `--text-primary` | neutral near-white (`#e8e9ec`) |
| `--text-secondary` | neutral gray (`#9a9ca6`) |
| `--text-muted` | `#63656e` |

- The purple `--accent` is removed. Interactive states become neutral:
  light-on-dark primary button (white/near-white bg, dark text), white active
  nav text. No saturated color outside the trims.
- Radii tighten: `--radius: 8px`, `--radius-sm: 6px`. Pills become squared
  tabs.
- All gradients removed: hero card, habit check, nav add button, area
  gradients.
- Chart series tokens (`--series-*`) stay as-is (separately validated
  palette).

### Trim palette (the only vibrant color)

From the Tactorius menu set (`arcane-chess/src/shared/styles/_variables.scss`,
`$*_MENU`):

| Token | Value |
|---|---|
| `--trim-r` | `#c53939` |
| `--trim-o` | `#c77c35` |
| `--trim-y` | `#d9b800` |
| `--trim-g` | `#34aa48` |
| `--trim-b` | `#3f48cc` |
| `--trim-v` | `#a043a2` |

Trim usage — and nothing else is colored:

- 3px left edge on area cards and on item rows shown in an area context
- Icon stroke color in area headers
- Active bucket-tab underline
- The old `--gold` (streaks/points) → `--trim-y`; the old `--good` →
  `--trim-g`

Area → trim mapping (2 areas per color):

| Trim | Areas |
|---|---|
| red | Fitness, Health |
| orange | Work, Schedule |
| yellow | Habits (Keystone), Finance |
| green | Diet, Budget |
| blue | Projects, Learnings |
| violet | Journal, Philosophy & Quotes |

## Shadows (elevation system)

Cards sit lighter than the page bg and carry two-layer shadows; borders stay
(1px, subtle) so edges hold on cheap screens.

- Card: `box-shadow: 0 1px 2px rgba(0,0,0,.55), 0 4px 16px rgba(0,0,0,.35)`
- Sheet/modal: adds a deeper third layer (e.g. `0 12px 40px rgba(0,0,0,.5)`)

## Icons (`lucide-react`)

Every emoji is replaced. `areas.js` `icon: '🚀'` becomes an icon *name*
resolved through one small `AreaIcon` component so the registry stays
serializable.

| Area | Icon |
|---|---|
| Projects | `Rocket` |
| Finance | `Wallet` |
| Budget | `ChartColumn` |
| Work | `Briefcase` |
| Fitness | `Dumbbell` |
| Diet | `Salad` |
| Health | `Stethoscope` |
| Schedule | `CalendarDays` |
| Keystone Habits | `KeyRound` |
| Journal | `NotebookPen` |
| Philosophy & Quotes | `Landmark` |
| Learnings | `Brain` |

Nav: `House`, `LayoutGrid`, `Plus`, `KeyRound`, `NotebookPen`. Inline glyphs:
✓ → `Check`, 🔥 → `Flame`, drag dots → `GripVertical`, detail chevron →
`ChevronRight`.

Verification: grep for the emoji unicode range across `src/` must return zero
matches when done.

## Layout — `AppShell`

New `AppShell` component wraps the routes. CSS grid + one media query; the
only JS branching is rendering the sidebar (desktop) vs. nothing.

- **≥900px:** fixed 232px left sidebar — wordmark, nav items with icons,
  Quick Add button, compact level/points block at the bottom. Content in a
  max-1100px column. Dashboard becomes two-column (stats + chart left,
  journal/quote right); area grid 3–4 columns. Bottom nav hidden.
- **<900px:** today's structure exactly — single column, bottom nav
  (re-iconed, gradient removed from the + button).

## Unchanged

Store, routing (HashRouter), server, rewards/levels logic, chart component
internals (colors already tokenized), PWA setup.

## Testing

- Existing vitest suite stays green; oxlint clean.
- Visual check via `pnpm dev` at desktop width and 390px viewport.
- Emoji-grep sweep returns zero matches in `src/`.
