/**
 * Area registry — the single place a life-area is defined.
 * Adding an area = adding a row here. Every view is generic over this config.
 *
 * kind:
 *  - 'list'    - items (tasks/entries) with buckets
 *  - 'habits'  - recurring items with daily check-ins + streaks
 *  - 'journal' - dated notes
 *  - 'library' - items where each entry carries its own notes (books, videos…)
 *
 * `icon` is a lucide-react component name rendered via <AreaIcon>.
 * `trim` picks one of the six --trim-* tokens (theme in index.css); it is the
 * area's only color — a thin edge/tint, never a fill. Identity in the UI is
 * ALWAYS icon + name. Chart series colors (--series-*) are a separately
 * validated palette.
 *
 * `daily` marks an area as part of the daily practice rendered by DailyStack
 * and PracticeGrid. `order` is 1..4, bottom-to-top in the stacked bar and
 * top-to-bottom in a grid cell. `series` indexes the CVD-validated
 * --series-* palette in index.css. Areas without `daily` are excluded from
 * both views: finishing a bill is real work but is not a daily rhythm.
 * Adding a fifth daily area means adding this field plus a --series-5 check;
 * no component changes.
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
    keywords: ['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay', 'budget', 'spend', 'expense', 'cost'],
    buckets: ['Bills', 'Insurance', 'Investments', 'Savings', 'Fixed', 'Variable', 'Goals'],
  },
  {
    id: 'fitness', name: 'Fitness', icon: 'Dumbbell', kind: 'list',
    trim: 'y',
    daily: { order: 3, series: 4 },
    keywords: ['workout', 'gym', 'run', 'lift', 'exercise', 'training'],
    buckets: ['Routine', 'Goals', 'PRs'],
  },
  {
    id: 'diet', name: 'Diet', icon: 'Salad', kind: 'list',
    trim: 'g',
    daily: { order: 2, series: 3 },
    keywords: ['eat', 'food', 'meal', 'diet', 'nutrition', 'recipe'],
    buckets: ['Plan', 'Groceries', 'Recipes'],
  },
  {
    id: 'health', name: 'Health', icon: 'Stethoscope', kind: 'list',
    trim: 'r',
    keywords: ['doctor', 'dentist', 'sleep', 'meds', 'appointment', 'health'],
    buckets: ['Upcoming', 'Tracking', 'Records'],
  },
  {
    id: 'habits', name: 'Keystone Habits', icon: 'KeyRound', kind: 'habits',
    trim: 'r',
    daily: { order: 4, series: 2 },
    keywords: ['habit', 'daily', 'streak', 'keystone'],
    buckets: [],
  },
  {
    id: 'journal', name: 'Journal', icon: 'NotebookPen', kind: 'journal',
    trim: 'b',
    daily: { order: 1, series: 1 },
    keywords: ['journal', 'today i', 'feeling', 'grateful', 'reflect'],
    buckets: [],
  },
  {
    id: 'philosophy', name: 'Philosophy & Quotes', icon: 'Landmark', kind: 'library',
    trim: 'v',
    keywords: ['quote', 'stoic', 'philosophy', 'principle', 'virtue'],
    buckets: ['Quotes', 'Principles', 'Essays'],
  },
  {
    id: 'learnings', name: 'Learnings', icon: 'Brain', kind: 'library',
    trim: 'o',
    keywords: ['book', 'read', 'watch', 'listen', 'course', 'video', 'podcast', 'learn'],
    buckets: ['Read', 'Watch', 'Listen'],
  },
]

export const areaById = (id) => AREAS.find((a) => a.id === id)

/** The daily-practice areas, pre-sorted bottom-to-top for the stack. */
export const DAILY_BANDS = AREAS.filter((a) => a.daily).sort(
  (a, b) => a.daily.order - b.daily.order,
)
