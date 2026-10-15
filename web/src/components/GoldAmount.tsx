import { splitCopper } from '@/lib/format'
import { cn } from '@/lib/utils'

interface GoldAmountProps {
  copper: number | null | undefined
  compact?: boolean
  /** Color the whole value green/red by sign instead of coin colors. */
  signed?: boolean
  className?: string
}

/** Renders a copper value as WoW currency with gold/silver/copper coloring. */
export function GoldAmount({ copper, compact = false, signed = false, className }: GoldAmountProps) {
  if (copper === null || copper === undefined || !Number.isFinite(copper)) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }
  const { negative, gold, silver, copper: c } = splitCopper(copper)
  const showSilver = silver > 0 && !(compact && gold >= 1000)
  const showCopper = c > 0 && !(compact && gold > 0)
  const tone = signed ? (copper > 0 ? 'text-success' : copper < 0 ? 'text-destructive' : '') : ''
  const isZero = gold === 0 && silver === 0 && c === 0

  return (
    <span className={cn('whitespace-nowrap font-mono tabular-nums', tone, className)}>
      {negative && '-'}
      {gold > 0 && (
        <span>
          {gold.toLocaleString('en-US')}
          <span className={cn(!signed && 'text-gold', 'ml-px text-[0.8em]')}>g</span>
        </span>
      )}
      {showSilver && (
        <span className="ml-1">
          {silver}
          <span className={cn(!signed && 'text-silver', 'ml-px text-[0.8em]')}>s</span>
        </span>
      )}
      {(showCopper || isZero) && (
        <span className={gold > 0 || showSilver ? 'ml-1' : ''}>
          {c}
          <span className={cn(!signed && 'text-copper', 'ml-px text-[0.8em]')}>c</span>
        </span>
      )}
    </span>
  )
}
