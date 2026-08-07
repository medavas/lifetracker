import React from 'react'
import {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain, BellRing,
  House, LayoutGrid,
} from 'lucide-react'

/**
 * Renders a lucide icon by registry name (AREAS[n].icon, or a sidebar
 * entry's icon — see sidebarOrder.js). Null if unknown. Static map so the
 * bundler tree-shakes lucide down to these icons — add the import + map
 * entry when a new area or sidebar entry lands.
 */
export const ICONS = {
  Rocket, Wallet, ChartColumn, Briefcase, Dumbbell, Salad,
  Stethoscope, CalendarDays, KeyRound, NotebookPen, Landmark, Brain, BellRing,
  House, LayoutGrid,
}

export default function AreaIcon({ name, size = 18, ...rest }) {
  const Icon = ICONS[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.75} {...rest} />
}
