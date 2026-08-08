import { useState } from 'react'
import { topSetSeries, lineGeometry, liveSets, formatWeight, isAssisted } from '../../lib/workout'

const W = 320
const H = 104

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * Top-set weight per session for one exercise — the only number that says
 * whether double progression is actually working.
 *
 * One series, so there is no legend: the picker names the data. The y-axis
 * deliberately does not start at zero (a 135->140 lb week would be invisible
 * against one), so the range is always printed beside the plot —
 * lineGeometry's contract.
 *
 * The picker reads from the exercise index rather than the live program, so
 * an exercise you have since retired still shows the history you built on it.
 */
export default function ProgressChart({ logs, exerciseIndex }) {
  const [picked, setPicked] = useState(null)
  const [tip, setTip] = useState(null)

  const logged = new Set(liveSets(logs).map((l) => l.itemId))
  const trained = [...exerciseIndex.values()]
    .filter((e) => logged.has(e.id))
    .sort((a, b) => a.title.localeCompare(b.title))

  const exercise = trained.find((e) => e.id === picked) ?? trained[0]

  if (!exercise) {
    return (
      <section className="fin-section card">
        <h3>Progression</h3>
        <div className="empty-note">Log a couple of sessions and your progress shows up here.</div>
      </section>
    )
  }

  const points = topSetSeries(logs, exercise)
  const { pts, path, min, max } = lineGeometry(points, { width: W, height: H })
  const latest = points[points.length - 1]
  const first = points[0]
  const delta = points.length > 1 ? latest.weight - first.weight : 0
  const better = isAssisted(exercise) ? -delta : delta

  return (
    <section className="fin-section card">
      <h3>Progression</h3>

      <select
        className="wo-picker"
        value={exercise.id}
        onChange={(e) => { setPicked(e.target.value); setTip(null) }}
        aria-label="Exercise to chart"
      >
        {trained.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}{e.status === 'archived' ? ' (retired)' : ''}
          </option>
        ))}
      </select>

      <div className="fin-sub wo-progress-line">
        Working {formatWeight(latest.weight)} × {latest.reps}
        {points.length > 1 && (
          <>
            {' · '}
            {better > 0 ? 'up' : better < 0 ? 'down' : 'flat'}{' '}
            {better === 0 ? '' : `${Math.abs(delta)} lb `}
            over {points.length} sessions
          </>
        )}
        {isAssisted(exercise) && ' · assist weight, so down is stronger'}
      </div>

      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${exercise.title} top-set weight per session`}
          onMouseLeave={() => setTip(null)}
        >
          <path d={path} fill="none" stroke="var(--series-4)" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p) => (
            <g key={p.date}>
              <circle cx={p.x} cy={p.y} r="2.6" fill="var(--series-4)"
                stroke="var(--surface-1)" strokeWidth="1.2" pointerEvents="none" />
              <rect
                x={p.x - W / (pts.length * 2)} y={0}
                width={W / pts.length} height={H} fill="transparent"
                onMouseEnter={() => setTip(p)}
                onTouchStart={() => setTip(p)}
              />
            </g>
          ))}
        </svg>

        {tip && (
          <div
            className="chart-tip"
            style={{ left: `${Math.min(88, Math.max(12, (tip.x / W) * 100))}%`, top: `${(tip.y / H) * 100}%` }}
          >
            <b>{shortDate(tip.date)}</b>
            <div className="tip-row">
              <span className="tip-dot" style={{ background: 'var(--series-4)' }} />
              {formatWeight(tip.weight)} × {tip.reps}
              <b>{tip.sets} sets</b>
            </div>
          </div>
        )}

        {/* The y-axis starts at `min`, not zero — say so, rather than letting
            the plot imply a scale it does not have. */}
        <div className="wo-scale">
          <span>{min === max ? formatWeight(min) : `${min}–${max} lb`}</span>
          <span>{points.length > 1 ? `${shortDate(first.date)} – ${shortDate(latest.date)}` : shortDate(latest.date)}</span>
        </div>
      </div>
    </section>
  )
}
