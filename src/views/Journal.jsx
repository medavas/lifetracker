import React from 'react'
import { Navigate } from 'react-router-dom'

/**
 * Default Journal entry point: redirect to the current month's day list.
 * No hooks -- this makes it the one Journal component genuinely testable
 * by calling it as a plain function, per the AreaIcon.test.js convention.
 */
export default function Journal() {
  const now = new Date()
  return <Navigate to={`/journal/years/${now.getFullYear()}/${now.getMonth() + 1}`} replace />
}
