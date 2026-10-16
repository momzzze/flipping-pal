// Types mirroring the Azeroth Flip REST API. All prices are in copper.

export type ItemQuality =
  | 'POOR'
  | 'COMMON'
  | 'UNCOMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'ARTIFACT'
  | 'HEIRLOOM'
  | 'UNKNOWN'

export const ITEM_QUALITIES: ItemQuality[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']

export type DataSource = 'BLIZZARD' | 'MANUAL' | 'SAMPLE' | 'FOREVER_BETA'
export type DataMode = 'LIVE' | 'SAMPLE' | 'SCAN' | 'NONE'
export type SellPriceStrategy = 'MIN' | 'MARKET'

export interface Item {
  id: number
  name: string
  quality: ItemQuality
  iconUrl: string | null
  craftingQuality: number | null
  isCommodity: boolean
  source: DataSource
}

export interface Snapshot {
  id: number
  region: string
  scope: 'COMMODITY' | 'REALM'
  connectedRealmId: number | null
  isSample: boolean
  fetchedAt: string
  sourceLastModified: string | null
  auctionCount: number
  itemCount: number
}

export interface SnapshotItem {
  itemId: number
  itemName: string
  minUnitPrice: number
  marketUnitPrice: number
  medianUnitPrice: number
  totalQuantity: number
  listingCount: number
}

export interface SnapshotItemsPage {
  snapshot: Snapshot
  total: number
  limit: number
  offset: number
  items: SnapshotItem[]
}

export interface Status {
  region: string
  targetExpansionName: string
  blizzardConfigured: boolean
  dataMode: DataMode
  commoditySnapshot: Snapshot | null
  latestScanSnapshot: Snapshot | null
  lastLiveSnapshot: Snapshot | null
  sampleDataLoaded: boolean
  recipes: { total: number; complete: number; incomplete: number }
  ahCutRate: number
  autoRefreshMinutes: number
}

export interface Profession {
  id: number
  name: string
  iconUrl: string | null
  source: DataSource
  recipeCount: number
  skillTiers: Array<{
    id: number
    name: string
    expansionId: number | null
    expansionName: string | null
    recipeCount: number
  }>
}

export interface Expansion {
  id: number
  slug: string
  name: string
  sortOrder: number
}

export interface ConnectedRealm {
  id: number
  region: string
  name: string
  realmSlugs: string[]
}

export interface ProfitRow {
  recipeId: number
  recipeName: string
  professionId: number
  professionName: string
  skillTierName: string | null
  expansionId: number | null
  expansionName: string | null
  category: string | null
  source: DataSource
  isComplete: boolean
  manuallyEdited: boolean
  watchlisted: boolean
  outputItem: Item | null
  outputQuantityPerCraft: number
  crafts: number
  materialCost: number | null
  sellUnitPrice: number | null
  grossRevenue: number | null
  ahFee: number | null
  netProfit: number | null
  netProfitPerCraft: number | null
  roiPercent: number | null
  outputSupply: number | null
  outputListings: number | null
  maxCraftsFromSupply: number | null
  missingReagentPrices: number
  missingOutputPrice: boolean
  insufficientReagentSupply: boolean
}

export interface ProfitTable {
  dataMode: DataMode
  commoditySnapshot: Snapshot | null
  realmSnapshot: Snapshot | null
  ahCutRate: number
  crafts: number
  sellPriceStrategy: SellPriceStrategy
  generatedAt: string
  rows: ProfitRow[]
}

export interface PriceTier {
  unitPrice: number
  quantity: number
}

export interface ItemPrice {
  itemId: number
  scope: 'COMMODITY' | 'REALM'
  snapshotId: number
  isSample: boolean
  minUnitPrice: number
  marketUnitPrice: number
  medianUnitPrice: number
  totalQuantity: number
  listingCount: number
  priceTiers: PriceTier[]
}

export interface CraftingModifiers {
  multicraftChance: number
  multicraftYieldBonus: number
  resourcefulnessChance: number
  resourcefulnessSavings: number
}

export interface Recipe {
  id: number
  blizzardRecipeId: number | null
  externalId: string | null
  catalogVersion: string | null
  name: string
  professionId: number
  professionName: string
  skillTierId: number | null
  skillTierName: string | null
  expansionId: number | null
  expansionName: string | null
  category: string | null
  outputItem: Item | null
  outputQuantityMin: number
  outputQuantityMax: number
  multicraftEligible: boolean
  resourcefulnessEligible: boolean
  concentrationEligible: boolean
  isComplete: boolean
  manuallyEdited: boolean
  source: DataSource
  notes: string | null
  reagents: Array<{
    itemId: number
    item: Item
    quantity: number
    isOptional: boolean
    affectedByResourcefulness: boolean
  }>
}

export interface RecipeBreakdown {
  dataMode: DataMode
  commoditySnapshot: Snapshot | null
  realmSnapshot: Snapshot | null
  ahCutRate: number
  sellPriceStrategy: SellPriceStrategy
  modifiers: CraftingModifiers
  recipe: Recipe
  watchlisted: boolean
  result: {
    crafts: number
    materialCost: number | null
    materialCostPerCraft: number | null
    expectedOutputQuantity: number
    sellUnitPrice: number | null
    grossRevenue: number | null
    ahFee: number | null
    netRevenue: number | null
    netProfit: number | null
    netProfitPerCraft: number | null
    roi: number | null
    missingReagentPrices: number[]
    missingOutputPrice: boolean
    insufficientReagentSupply: boolean
  }
  output: { item: Item; price: ItemPrice | null } | null
  reagents: Array<{
    item: Item
    quantityPerCraft: number
    isOptional: boolean
    requiredQuantity: number
    totalCost: number | null
    averageUnitPrice: number | null
    marginalUnitPrice: number | null
    isFullyFilled: boolean | null
    minUnitPrice: number | null
    marketUnitPrice: number | null
    supply: number | null
    listings: number | null
    priceTiers: PriceTier[]
  }>
}

export interface ProfitHistory {
  recipeId: number
  recipeName: string
  dataMode: DataMode
  points: Array<{
    snapshotId: number
    fetchedAt: string
    materialCost: number | null
    sellUnitPrice: number | null
    netProfit: number | null
    roiPercent: number | null
  }>
}

export interface RecipeImportSummary {
  professionId: number
  professionName: string
  skillTierId: number
  skillTierName: string
  total: number
  imported: number
  complete: number
  incomplete: number
  skippedManual: number
  failed: Array<{ recipeId: number; error: string }>
}

export interface RefreshResult {
  status: 'updated' | 'not-modified' | 'no-tracked-items'
  snapshot: Snapshot | null
  trackedItems: number
  pricedItems: number
}

export interface Filters {
  professionId?: number
  expansionId?: number
  quality: ItemQuality[]
  /** Gold (converted to copper for the API). */
  minProfitGold?: number
  minRoi?: number
  minSupply?: number
  includeIncomplete: boolean
  watchlistOnly: boolean
  crafts: number
  sellPriceStrategy: SellPriceStrategy
  search: string
  realmId?: number
}

export interface RecipeUpdate {
  name?: string
  category?: string
  outputItemId?: number | null
  outputQuantityMin?: number
  outputQuantityMax?: number
  multicraftEligible?: boolean
  resourcefulnessEligible?: boolean
  concentrationEligible?: boolean
  notes?: string
  reagents?: Array<{ itemId: number; quantity: number; isOptional?: boolean }>
}
