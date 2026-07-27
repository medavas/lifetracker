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
 * `grad` is a UI accent gradient. Identity in the UI is ALWAYS icon + name;
 * color is reinforcement, never the only signal. Chart series colors live in
 * theme.css (--series-*) and are a separately validated palette.
 */
export const AREAS = [
  {
    id: 'projects', name: 'Projects', icon: '🚀', kind: 'list',
    grad: ['#7048e8', '#9775fa'],
    keywords: ['project', 'build', 'ship', 'idea'],
    buckets: ['Active', 'Backlog', 'Someday'],
  },
  {
    id: 'finance', name: 'Finance', icon: '💰', kind: 'list',
    grad: ['#0ca678', '#38d9a9'],
    keywords: ['money', 'bill', 'insurance', 'invest', 'savings', 'bank', 'pay'],
    buckets: ['Bills', 'Insurance', 'Investments', 'Savings'],
  },
  {
    id: 'budget', name: 'Budget', icon: '📊', kind: 'list',
    grad: ['#1098ad', '#3bc9db'],
    keywords: ['budget', 'spend', 'expense', 'cost'],
    buckets: ['Fixed', 'Variable', 'Goals'],
  },
  {
    id: 'work', name: 'Work', icon: '💼', kind: 'list',
    grad: ['#4c6ef5', '#748ffc'],
    keywords: ['work', 'job', 'meeting', 'career'],
    buckets: ['Now', 'Next', 'Waiting'],
  },
  {
    id: 'fitness', name: 'Fitness', icon: '💪', kind: 'list',
    grad: ['#f03e3e', '#ff8787'],
    keywords: ['workout', 'gym', 'run', 'lift', 'exercise', 'training'],
    buckets: ['Routine', 'Goals', 'PRs'],
  },
  {
    id: 'diet', name: 'Diet', icon: '🥗', kind: 'list',
    grad: ['#66a80f', '#a9e34b'],
    keywords: ['eat', 'food', 'meal', 'diet', 'nutrition', 'recipe'],
    buckets: ['Plan', 'Groceries', 'Recipes'],
  },
  {
    id: 'health', name: 'Health', icon: '🩺', kind: 'list',
    grad: ['#e8590c', '#ffa94d'],
    keywords: ['doctor', 'dentist', 'sleep', 'meds', 'appointment', 'health'],
    buckets: ['Upcoming', 'Tracking', 'Records'],
  },
  {
    id: 'schedule', name: 'Schedule', icon: '🗓️', kind: 'list',
    grad: ['#3b5bdb', '#5c7cfa'],
    keywords: ['today', 'tomorrow', 'week', 'plan', 'schedule'],
    buckets: ['Today', 'This Week', 'Recurring'],
  },
  {
    id: 'habits', name: 'Keystone Habits', icon: '🔑', kind: 'habits',
    grad: ['#f59f00', '#ffd43b'],
    keywords: ['habit', 'daily', 'streak', 'keystone'],
    buckets: [],
  },
  {
    id: 'journal', name: 'Journal', icon: '📓', kind: 'journal',
    grad: ['#d6336c', '#faa2c1'],
    keywords: ['journal', 'today i', 'feeling', 'grateful', 'reflect'],
    buckets: [],
  },
  {
    id: 'philosophy', name: 'Philosophy & Quotes', icon: '🏛️', kind: 'library',
    grad: ['#9c36b5', '#da77f2'],
    keywords: ['quote', 'stoic', 'philosophy', 'principle', 'virtue'],
    buckets: ['Quotes', 'Principles', 'Essays'],
  },
  {
    id: 'learnings', name: 'Learnings', icon: '🧠', kind: 'library',
    grad: ['#1971c2', '#4dabf7'],
    keywords: ['book', 'read', 'watch', 'listen', 'course', 'video', 'podcast', 'learn'],
    buckets: ['Read', 'Watch', 'Listen'],
  },
]

export const areaById = (id) => AREAS.find((a) => a.id === id)
