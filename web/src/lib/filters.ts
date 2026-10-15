import type { Filters } from './types'

export const DEFAULT_FILTERS: Filters = {
  quality: [],
  includeIncomplete: false,
  watchlistOnly: false,
  crafts: 1,
  sellPriceStrategy: 'MIN',
  search: '',
}
