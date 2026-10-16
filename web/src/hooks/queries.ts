import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CraftingModifiers, Filters, RecipeUpdate } from '@/lib/types'

export const queryKeys = {
  status: ['status'] as const,
  professions: ['professions'] as const,
  expansions: ['expansions'] as const,
  realms: ['connected-realms'] as const,
  scanItems: (snapshotId: number, search: string, offset: number) => ['scan-items', snapshotId, search, offset] as const,
  profits: (filters: Filters) => ['profits', filters] as const,
  breakdown: (recipeId: number, params: object) => ['breakdown', recipeId, params] as const,
  history: (recipeId: number) => ['recipe-history', recipeId] as const,
  recipes: (params: object) => ['recipes', params] as const,
  items: (q: string) => ['items', q] as const,
  modifiers: (professionId: number) => ['modifiers', professionId] as const,
}

export const useStatus = () => useQuery({ queryKey: queryKeys.status, queryFn: api.status, refetchInterval: 60_000 })
export const useProfessions = () => useQuery({ queryKey: queryKeys.professions, queryFn: api.professions })
export const useExpansions = () => useQuery({ queryKey: queryKeys.expansions, queryFn: api.expansions })
export const useConnectedRealms = () => useQuery({ queryKey: queryKeys.realms, queryFn: api.connectedRealms })

export const useScanItems = (snapshotId: number | undefined, search: string, offset: number, limit = 50) =>
  useQuery({
    queryKey: queryKeys.scanItems(snapshotId ?? 0, search, offset),
    queryFn: () => api.snapshotItems(snapshotId!, { search, offset, limit }),
    enabled: snapshotId !== undefined,
    placeholderData: keepPreviousData,
  })

export const useProfits = (filters: Filters) =>
  useQuery({
    queryKey: queryKeys.profits(filters),
    queryFn: () => api.profits(filters),
    placeholderData: keepPreviousData,
  })

export const useRecipeBreakdown = (
  recipeId: number | null,
  params: { crafts: number; sellPriceStrategy: string; realmId?: number },
) =>
  useQuery({
    queryKey: queryKeys.breakdown(recipeId ?? 0, params),
    queryFn: () => api.breakdown(recipeId!, params),
    enabled: recipeId !== null,
    placeholderData: keepPreviousData,
  })

export const useRecipeHistory = (recipeId: number | null) =>
  useQuery({
    queryKey: queryKeys.history(recipeId ?? 0),
    queryFn: () => api.recipeHistory(recipeId!),
    enabled: recipeId !== null,
  })

export const useRecipes = (params: { professionId?: number; search?: string; incomplete?: boolean }) =>
  useQuery({ queryKey: queryKeys.recipes(params), queryFn: () => api.recipes(params), placeholderData: keepPreviousData })

export const useItemSearch = (q: string) =>
  useQuery({ queryKey: queryKeys.items(q), queryFn: () => api.searchItems(q), enabled: q.trim().length >= 2 })

export const useModifiers = (professionId: number | undefined) =>
  useQuery({
    queryKey: queryKeys.modifiers(professionId ?? 0),
    queryFn: () => api.modifiers(professionId!),
    enabled: professionId !== undefined,
  })

/** Invalidates everything derived from recipes or prices. */
function useInvalidateData() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.status }),
      client.invalidateQueries({ queryKey: queryKeys.professions }),
      client.invalidateQueries({ queryKey: queryKeys.expansions }),
      client.invalidateQueries({ queryKey: ['profits'] }),
      client.invalidateQueries({ queryKey: ['breakdown'] }),
      client.invalidateQueries({ queryKey: ['recipe-history'] }),
      client.invalidateQueries({ queryKey: ['recipes'] }),
      client.invalidateQueries({ queryKey: ['modifiers'] }),
    ])
}

export function useDataMutations() {
  const invalidate = useInvalidateData()
  const client = useQueryClient()
  return {
    sync: useMutation({ mutationFn: (professionId?: number) => api.sync(professionId), onSuccess: invalidate }),
    refreshCommodities: useMutation({
      mutationFn: (force: boolean) => api.refreshCommodities(force),
      onSuccess: invalidate,
    }),
    refreshRealm: useMutation({ mutationFn: (realmId: number) => api.refreshRealm(realmId), onSuccess: invalidate }),
    loadSample: useMutation({ mutationFn: api.loadSample, onSuccess: invalidate }),
    clearSample: useMutation({ mutationFn: api.clearSample, onSuccess: invalidate }),
    syncRealms: useMutation({
      mutationFn: api.syncConnectedRealms,
      onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.realms }),
    }),
  }
}

export function useWatchlistToggle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ recipeId, watch }: { recipeId: number; watch: boolean }) =>
      watch ? api.addToWatchlist(recipeId) : api.removeFromWatchlist(recipeId),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['profits'] }),
        client.invalidateQueries({ queryKey: ['breakdown'] }),
      ]),
  })
}

export function useRecipeMutations() {
  const invalidate = useInvalidateData()
  return {
    update: useMutation({
      mutationFn: ({ id, update }: { id: number; update: RecipeUpdate }) => api.updateRecipe(id, update),
      onSuccess: invalidate,
    }),
    reset: useMutation({ mutationFn: (id: number) => api.resetRecipe(id), onSuccess: invalidate }),
  }
}

export function useUpdateModifiers() {
  const invalidate = useInvalidateData()
  return useMutation({
    mutationFn: ({ professionId, modifiers }: { professionId: number; modifiers: CraftingModifiers }) =>
      api.updateModifiers(professionId, modifiers),
    onSuccess: invalidate,
  })
}
