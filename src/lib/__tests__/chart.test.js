import { describe, it, expect } from 'vitest'
import { stackGeometry } from '../chart.js'
import { DAILY_BANDS } from '../../data/areas.js'

const day = (date, bands) => ({
  date,
  bands: { journal: 0, diet: 0, fitness: 0, habits: 0, ...bands },
  total: Object.values({ journal: 0, diet: 0, fitness: 0, habits: 0, ...bands }).reduce((s, v) => s + v, 0),
})

const OPTS = { width: 320, height: 120, gap: 10, pad: 4 }

describe('stackGeometry', () => {
  it('produces one column per day', () => {
    const days = [day('2026-08-01', {}), day('2026-08-02', {}), day('2026-08-03', {})]
    expect(stackGeometry(days, DAILY_BANDS, OPTS)).toHaveLength(3)
  })

  it('gives a zero day no segments', () => {
    const out = stackGeometry([day('2026-08-01', {})], DAILY_BANDS, OPTS)
    expect(out[0].segments).toEqual([])
    expect(out[0].total).toBe(0)
  })

  it('omits zero-count bands from a non-empty day', () => {
    const out = stackGeometry([day('2026-08-01', { diet: 2 })], DAILY_BANDS, OPTS)
    expect(out[0].segments.map((s) => s.areaId)).toEqual(['diet'])
  })

  it('orders segments bottom-to-top by band order', () => {
    const d = day('2026-08-01', { journal: 1, diet: 1, fitness: 1, habits: 1 })
    const segs = stackGeometry([d], DAILY_BANDS, OPTS)[0].segments
    expect(segs.map((s) => s.areaId)).toEqual(['journal', 'diet', 'fitness', 'habits'])
    // Larger y is lower on screen in SVG, so journal must sit lowest.
    for (let i = 1; i < segs.length; i++) expect(segs[i].y).toBeLessThan(segs[i - 1].y)
  })

  it('stacks segments flush with no gaps between them', () => {
    const d = day('2026-08-01', { journal: 1, habits: 3 })
    const segs = stackGeometry([d], DAILY_BANDS, OPTS)[0].segments
    expect(segs[0].y + segs[0].h).toBeCloseTo(OPTS.height)
    expect(segs[1].y + segs[1].h).toBeCloseTo(segs[0].y)
  })

  it('scales the busiest day to the full plot height', () => {
    const days = [day('2026-08-01', { diet: 1 }), day('2026-08-02', { habits: 4 })]
    const out = stackGeometry(days, DAILY_BANDS, OPTS)
    const tallest = out[1].segments[0]
    expect(tallest.h).toBeCloseTo(OPTS.height - 14)
    expect(out[0].segments[0].h).toBeCloseTo((OPTS.height - 14) / 4)
  })

  it('carries the series slot and count through for rendering', () => {
    const segs = stackGeometry([day('2026-08-01', { habits: 2 })], DAILY_BANDS, OPTS)[0].segments
    expect(segs[0]).toMatchObject({ areaId: 'habits', series: 2, count: 2 })
  })

  it('keeps the hit target wider than the visible bar', () => {
    const out = stackGeometry([day('2026-08-01', { diet: 1 })], DAILY_BANDS, OPTS)
    expect(out[0].w).toBeLessThan(out[0].colW)
    expect(out[0].x).toBeGreaterThan(out[0].colX)
  })

  // Finance stacks spending categories, whose palette slot lives on the item
  // rather than in the area registry.
  it('takes the series slot from seriesOf when one is given', () => {
    const bands = [{ id: 'groceries', series: 5 }, { id: 'fun', series: 3 }]
    const col = { date: '2026-08-01', bands: { groceries: 1000, fun: 500 }, total: 1500 }
    const segs = stackGeometry([col], bands, { ...OPTS, seriesOf: (b) => b.series })[0].segments
    expect(segs.map((s) => [s.areaId, s.series, s.count])).toEqual([
      ['groceries', 5, 1000],
      ['fun', 3, 500],
    ])
    // stacked from the baseline up: the second band sits above the first
    expect(segs[1].y).toBeLessThan(segs[0].y)
  })
})
