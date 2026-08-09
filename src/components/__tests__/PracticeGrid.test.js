import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PracticeGrid from '../PracticeGrid'
import { dailyPresence, QUARTER_WEEKS } from '../../lib/rewards.js'

const occurrences = (html, cls) => (html.match(new RegExp(`class="[^"]*\\b${cls}\\b`, 'g')) || []).length

/**
 * The grid is laid out weeks-as-columns, so its shape is carried by the CSS
 * `--pg-weeks` count and by emitting cells day-major. Both are invisible to the
 * rewards tests and easy to flip back by accident while editing the component.
 */
describe('PracticeGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  const render = (weeks) =>
    renderToStaticMarkup(createElement(PracticeGrid, { weeks: dailyPresence([], [], weeks) }))

  it('emits one cell per day of the quarter window', () => {
    const html = render(QUARTER_WEEKS)
    expect(occurrences(html, 'pg-cell')).toBe(91)
  })

  it('emits seven day labels regardless of window length, not one per week', () => {
    expect(occurrences(render(QUARTER_WEEKS), 'pg-head')).toBe(7)
    expect(occurrences(render(5), 'pg-head')).toBe(7)
  })

  it('tells the CSS how many week columns to lay out', () => {
    expect(render(QUARTER_WEEKS)).toContain('--pg-weeks:13')
    expect(render(5)).toContain('--pg-weeks:5')
  })

  it('reserves one month-header slot per week column', () => {
    expect(occurrences(render(QUARTER_WEEKS), 'pg-month')).toBe(13)
  })
})
