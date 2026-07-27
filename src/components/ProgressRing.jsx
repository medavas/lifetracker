/** SVG progress ring; progress 0..1. Label goes in the center. */
export default function ProgressRing({ progress, label, size = 84, stroke = 8, color = 'var(--gold)' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Progress ${Math.round(clamped * 100)}%`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="ring-label">{label}</div>
    </div>
  )
}
