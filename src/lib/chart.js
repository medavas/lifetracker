/**
 * Layout math for the daily stacked bar, kept out of the component so it can
 * be tested: vitest runs in a node environment with no DOM, so a component
 * that calls hooks cannot be exercised directly.
 *
 * SVG y grows downward, so segments are laid out from the baseline upward and
 * a smaller y means higher on screen.
 */

/** Height reserved below the plot for weekday labels. */
const LABEL_H = 14

export function stackGeometry(days, bands, opts = {}) {
  const { width = 320, height = 120, gap = 10, pad = 4 } = opts
  const plotH = height - LABEL_H
  const colW = (width - pad * 2) / Math.max(1, days.length)
  const max = Math.max(1, ...days.map((d) => d.total))

  return days.map((d, i) => {
    const colX = pad + i * colW
    let y = height
    const segments = []
    for (const band of bands) {
      const count = d.bands[band.id] || 0
      if (count === 0) continue
      const h = (count / max) * plotH
      y -= h
      segments.push({ areaId: band.id, series: band.daily.series, count, y, h })
    }
    return {
      date: d.date,
      colX,
      colW,
      x: colX + gap / 2,
      w: Math.max(1, colW - gap),
      total: d.total,
      segments,
    }
  })
}
