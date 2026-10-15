export const COPPER_PER_SILVER = 100
export const COPPER_PER_GOLD = 10_000

export interface GoldParts {
  negative: boolean
  gold: number
  silver: number
  copper: number
}

export function splitCopper(copper: number): GoldParts {
  const negative = copper < 0
  const abs = Math.round(Math.abs(copper))
  return {
    negative,
    gold: Math.floor(abs / COPPER_PER_GOLD),
    silver: Math.floor((abs % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: abs % COPPER_PER_SILVER,
  }
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Formats a copper amount as WoW currency, e.g. 1234567 -> "123g 45s 67c".
 * `compact` drops copper (and silver above 1,000g) for dense tables.
 */
export function formatGold(copper: number | null | undefined, compact = false): string {
  if (copper === null || copper === undefined || !Number.isFinite(copper)) return '—'
  const { negative, gold, silver, copper: c } = splitCopper(copper)
  const parts: string[] = []
  if (gold > 0) parts.push(`${integer.format(gold)}g`)
  if (silver > 0 && !(compact && gold >= 1000)) parts.push(`${silver}s`)
  if (c > 0 && !(compact && gold > 0)) parts.push(`${c}c`)
  if (parts.length === 0) parts.push(compact && gold === 0 && silver === 0 && c === 0 ? '0g' : '0c')
  return `${negative ? '-' : ''}${parts.join(' ')}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

/** Formats a 0..1 fraction as an unsigned percentage (e.g. 0.05 → "5%"). */
export function formatShare(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return integer.format(value)
}

export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never'
  const diffMs = now - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export type ProfitTone = 'positive' | 'negative' | 'neutral' | 'unknown'

export function profitTone(value: number | null | undefined): ProfitTone {
  if (value === null || value === undefined) return 'unknown'
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}
