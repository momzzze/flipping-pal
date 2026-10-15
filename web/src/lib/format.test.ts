import { describe, expect, it } from 'vitest'
import { filtersToQuery } from './api'
import { formatGold, formatPercent, formatRelativeTime, formatShare, profitTone, splitCopper } from './format'

describe('formatGold', () => {
  it('splits copper into gold, silver and copper', () => {
    expect(splitCopper(1_234_567)).toEqual({ negative: false, gold: 123, silver: 45, copper: 67 })
    expect(formatGold(1_234_567)).toBe('123g 45s 67c')
  })

  it('handles negatives, zero and missing values', () => {
    expect(formatGold(-25_000)).toBe('-2g 50s')
    expect(formatGold(0)).toBe('0c')
    expect(formatGold(null)).toBe('—')
  })

  it('compacts large values', () => {
    expect(formatGold(12_345_678_90, true)).toBe('123,456g')
    expect(formatGold(1_234_567, true)).toBe('123g 45s')
  })
})

describe('formatPercent', () => {
  it('adds a sign for positive values', () => {
    expect(formatPercent(12.345)).toBe('+12.3%')
    expect(formatPercent(-3)).toBe('-3.0%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('helpers', () => {
  it('profitTone', () => {
    expect(profitTone(5)).toBe('positive')
    expect(profitTone(-5)).toBe('negative')
    expect(profitTone(null)).toBe('unknown')
  })

  it('formatRelativeTime', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(formatRelativeTime('2026-01-01T11:30:00Z', now)).toBe('30 min ago')
    expect(formatRelativeTime(null, now)).toBe('never')
  })

  it('filtersToQuery converts gold to copper and omits empty values', () => {
    const query = filtersToQuery({
      quality: ['RARE', 'EPIC'],
      minProfitGold: 1.5,
      includeIncomplete: false,
      watchlistOnly: false,
      crafts: 1,
      sellPriceStrategy: 'MIN',
      search: '  ',
    })
    expect(query).toBe('?quality=RARE%2CEPIC&minProfit=15000&crafts=1&sellPriceStrategy=MIN')
  })
})

describe('formatShare', () => {
  it('formats fractions as unsigned percentages', () => {
    expect(formatShare(0.05)).toBe('5%')
    expect(formatShare(0.125, 1)).toBe('12.5%')
    expect(formatShare(null)).toBe('—')
  })
})
