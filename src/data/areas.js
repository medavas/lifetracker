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
  {
    id: 'budget', name: 'Budget', icon: 'ChartColumn', kind: 'list',
    trim: 'g',
    keywords: ['budget', 'spend', 'expense', 'cost'],
    buckets: ['Fixed', 'Variable', 'Goals'],
  },
  {
    id: 'work', name: 'Work', icon: 'Briefcase', kind: 'list',
    trim: 'o',
    keywords: ['work', 'job', 'meeting', 'career'],
    buckets: ['Now', 'Next', 'Waiting'],
  },
  {
    id: 'fitness', name: 'Fitness', icon: 'Dumbbell', kind: 'list',
    trim: 'r',
    keywords: ['workout', 'gym', 'run', 'lift', 'exercise', 'training'],
    buckets: ['Routine', 'Goals', 'PRs'],
  },
  {
    id: 'diet', name: 'Diet', icon: 'Salad', kind: 'list',
    trim: 'g',
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
    id: 'schedule', name: 'Schedule', icon: 'CalendarDays', kind: 'list',
    trim: 'o',
    keywords: ['today', 'tomorrow', 'week', 'plan', 'schedule'],
    buckets: ['Today', 'This Week', 'Recurring'],
  },
  {
    id: 'habits', name: 'Keystone Habits', icon: 'KeyRound', kind: 'habits',
    trim: 'y',
    keywords: ['habit', 'daily', 'streak', 'keystone'],
    buckets: [],
  },
  {
    id: 'journal', name: 'Journal', icon: 'NotebookPen', kind: 'journal',
    trim: 'v',
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
    trim: 'b',
    keywords: ['book', 'read', 'watch', 'listen', 'course', 'video', 'podcast', 'learn'],
    buckets: ['Read', 'Watch', 'Listen'],
  },
]

export const areaById = (id) => AREAS.find((a) => a.id === id)
