import type { ItemQuality } from './types'

export const QUALITY_TEXT: Record<ItemQuality, string> = {
  POOR: 'text-q-poor',
  COMMON: 'text-q-common',
  UNCOMMON: 'text-q-uncommon',
  RARE: 'text-q-rare',
  EPIC: 'text-q-epic',
  LEGENDARY: 'text-q-legendary',
  ARTIFACT: 'text-q-artifact',
  HEIRLOOM: 'text-q-heirloom',
  UNKNOWN: 'text-foreground',
}
