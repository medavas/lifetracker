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
