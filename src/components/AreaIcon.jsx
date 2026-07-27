import React from 'react'
import {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain,
} from 'lucide-react'

/**
 * Renders a lucide icon by registry name (AREAS[n].icon). Null if unknown.
 * Static map so the bundler tree-shakes lucide down to these 12 icons —
 * add the import + map entry when a new area lands in areas.js.
 */
const ICONS = {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain,
}

export default function AreaIcon({ name, size = 18, ...rest }) {
  const Icon = ICONS[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.75} {...rest} />
}
