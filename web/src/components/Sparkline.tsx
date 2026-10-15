interface SparklineProps {
  values: Array<number | null>
  width?: number
  height?: number
  className?: string
}

/** Minimal dependency-free SVG sparkline. Gaps (null) are skipped. */
export function Sparkline({ values, width = 280, height = 56, className }: SparklineProps) {
  const defined = values.filter((value): value is number => value !== null)
  if (defined.length < 2) {
    return <p className="text-xs text-muted-foreground">Not enough snapshots for a trend yet.</p>
  }
  const min = Math.min(...defined, 0)
  const max = Math.max(...defined, 0)
  const range = max - min || 1
  const x = (index: number) => (index / (values.length - 1)) * width
  const y = (value: number) => height - ((value - min) / range) * height
  const path = values
    .map((value, index) => (value === null ? null : `${x(index).toFixed(1)},${y(value).toFixed(1)}`))
    .filter((point): point is string => point !== null)
    .join(' L')
  const last = defined[defined.length - 1]
  const zeroY = y(0)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} width="100%" height={height} preserveAspectRatio="none">
      <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="4 4" />
      <path
        d={`M${path}`}
        fill="none"
        stroke={last >= 0 ? 'var(--success)' : 'var(--destructive)'}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
