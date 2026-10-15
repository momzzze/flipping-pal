import type {
  ConnectedRealm,
  CraftingModifiers,
  Expansion,
  Filters,
  Item,
  Profession,
  ProfitHistory,
  ProfitTable,
  Recipe,
  RecipeBreakdown,
  RecipeImportSummary,
  RecipeUpdate,
  RefreshResult,
  Status,
} from './types'

const BASE_URL = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''}/api`

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the Azeroth Flip API. Is the server running on port 3000?')
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    const payload = (body ?? {}) as { message?: string | string[]; error?: string }
    const message = Array.isArray(payload.message) ? payload.message.join('; ') : payload.message
    throw new ApiError(response.status, message ?? `Request failed (${response.status})`, payload.error)
  }
  return body as T
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function filtersToQuery(filters: Filters): string {
  return toQuery({
    professionId: filters.professionId,
    expansionId: filters.expansionId,
    quality: filters.quality.length > 0 ? filters.quality.join(',') : undefined,
    minProfit: filters.minProfitGold !== undefined ? Math.round(filters.minProfitGold * 10_000) : undefined,
    minRoi: filters.minRoi,
    minSupply: filters.minSupply,
    includeIncomplete: filters.includeIncomplete || undefined,
    watchlistOnly: filters.watchlistOnly || undefined,
    crafts: filters.crafts,
    sellPriceStrategy: filters.sellPriceStrategy,
    search: filters.search.trim() || undefined,
    realmId: filters.realmId,
  })
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const api = {
  status: () => request<Status>('/status'),
  professions: () => request<Profession[]>('/professions'),
  expansions: () => request<Expansion[]>('/expansions'),
  connectedRealms: () => request<ConnectedRealm[]>('/connected-realms'),
  syncConnectedRealms: () => request<{ count: number }>('/connected-realms/sync', { method: 'POST' }),
  profits: (filters: Filters) => request<ProfitTable>(`/crafting/profits${filtersToQuery(filters)}`),
  breakdown: (recipeId: number, params: { crafts: number; sellPriceStrategy: string; realmId?: number }) =>
    request<RecipeBreakdown>(`/crafting/recipes/${recipeId}${toQuery(params)}`),
  recipeHistory: (recipeId: number, days = 7) =>
    request<ProfitHistory>(`/analytics/recipes/${recipeId}/history${toQuery({ days })}`),
  recipes: (params: { professionId?: number; search?: string; incomplete?: boolean }) =>
    request<Recipe[]>(`/recipes${toQuery({ ...params, incomplete: params.incomplete || undefined })}`),
  updateRecipe: (id: number, update: RecipeUpdate) =>
    request<Recipe>(`/recipes/${id}`, { method: 'PATCH', ...json(update) }),
  resetRecipe: (id: number) => request<Recipe>(`/recipes/${id}/reset-manual`, { method: 'POST' }),
  searchItems: (q: string) => request<Item[]>(`/items${toQuery({ q, limit: 15 })}`),
  syncItem: (id: number) => request<Item>(`/items/${id}/sync`, { method: 'POST' }),
  addToWatchlist: (recipeId: number) => request<unknown>('/watchlist', { method: 'POST', ...json({ recipeId }) }),
  removeFromWatchlist: (recipeId: number) => request<void>(`/watchlist/${recipeId}`, { method: 'DELETE' }),
  sync: (professionId?: number) =>
    request<{ recipes: RecipeImportSummary; auctions: RefreshResult }>('/sync', {
      method: 'POST',
      ...json(professionId ? { professionId } : {}),
    }),
  importRecipes: (professionId?: number) =>
    request<RecipeImportSummary>('/recipes/import', { method: 'POST', ...json(professionId ? { professionId } : {}) }),
  refreshCommodities: (force = false) =>
    request<RefreshResult>(`/auctions/commodities/refresh${toQuery({ force: force || undefined })}`, { method: 'POST' }),
  refreshRealm: (realmId: number) =>
    request<RefreshResult>(`/auctions/realms/${realmId}/refresh`, { method: 'POST' }),
  loadSample: () => request<{ items: number; recipes: number; snapshots: number }>('/sample/load', { method: 'POST' }),
  clearSample: () => request<void>('/sample', { method: 'DELETE' }),
  modifiers: (professionId: number) => request<CraftingModifiers>(`/crafting/modifiers/${professionId}`),
  updateModifiers: (professionId: number, modifiers: CraftingModifiers) =>
    request<CraftingModifiers>(`/crafting/modifiers/${professionId}`, { method: 'PUT', ...json(modifiers) }),
}
