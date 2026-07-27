import React from 'react'
import * as icons from 'lucide-react'

/** Renders a lucide icon by registry name (AREAS[n].icon). Null if unknown. */
export default function AreaIcon({ name, size = 18, ...rest }) {
  const Icon = icons[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.75} {...rest} />
}
