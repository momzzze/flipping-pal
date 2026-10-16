import { Info, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useProfits } from '@/hooks/queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { DEFAULT_FILTERS } from '@/lib/filters'
import type { Filters } from '@/lib/types'
import { ErrorState } from './ErrorState'
import { FilterSidebar } from './FilterSidebar'
import { GoldAmount } from './GoldAmount'
import { ProfitTable } from './ProfitTable'
import { RecipeDetailsPanel } from './RecipeDetailsPanel'

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-2.5">
      <p className="text-[0.65rem] tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 text-lg font-semibold">{children}</div>
    </div>
  )
}

interface DashboardProps {
  watchlistMode?: boolean
  onEditRecipe: (recipeId: number) => void
}

export function Dashboard({ watchlistMode = false, onEditRecipe }: DashboardProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)
  const effectiveFilters = useMemo(
    () => (watchlistMode ? { ...filters, watchlistOnly: true } : filters),
    [filters, watchlistMode],
  )
  const debouncedFilters = useDebouncedValue(effectiveFilters, 300)
  const profits = useProfits(debouncedFilters)
  const rows = useMemo(() => profits.data?.rows ?? [], [profits.data])

  const summary = useMemo(() => {
    const priced = rows.filter((row) => row.netProfitPerCraft !== null)
    const profitable = priced.filter((row) => (row.netProfitPerCraft ?? 0) > 0)
    const best = priced.reduce<(typeof priced)[number] | null>(
      (top, row) => (top === null || (row.netProfitPerCraft ?? 0) > (top.netProfitPerCraft ?? 0) ? row : top),
      null,
    )
    return { total: rows.length, priced: priced.length, profitable: profitable.length, best }
  }, [rows])

  return (
    <div className="flex min-h-0 flex-1">
      <FilterSidebar filters={filters} onChange={setFilters} hideWatchlistToggle={watchlistMode} />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
          <SummaryCard label={watchlistMode ? 'Watched recipes' : 'Recipes'}>{formatNumber(summary.total)}</SummaryCard>
          <SummaryCard label="Profitable now">
            <span className="text-success">{formatNumber(summary.profitable)}</span>
            <span className="text-sm text-muted-foreground"> / {formatNumber(summary.priced)} priced</span>
          </SummaryCard>
          <SummaryCard label="Best profit / craft">
            <GoldAmount copper={summary.best?.netProfitPerCraft ?? null} signed />
            {summary.best && <p className="truncate text-xs font-normal text-muted-foreground">{summary.best.recipeName}</p>}
          </SummaryCard>
          <SummaryCard label="Commodity prices">
            {profits.data?.realmSnapshot ? (
              <>
                {formatRelativeTime(profits.data.realmSnapshot.fetchedAt)}
                <p className="text-xs font-normal text-muted-foreground">Classic Forever scan</p>
              </>
            ) : profits.data?.commoditySnapshot ? (
              <>
                {formatRelativeTime(profits.data.commoditySnapshot.fetchedAt)}
                <p className="text-xs font-normal text-muted-foreground">
                  {profits.data.dataMode === 'SAMPLE' ? 'Sample snapshot (not live)' : 'Live EU snapshot'}
                </p>
              </>
            ) : (
              <span className="text-muted-foreground">No snapshot</span>
            )}
          </SummaryCard>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Profit = expected revenue − 5% AH cut − reagent cost (bought through the cheapest listings). Supply shows units
          currently listed — it is not a measure of sales or demand.
          {profits.isFetching && !profits.isLoading && <span className="ml-auto animate-pulse">Updating…</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {profits.isError ? (
            <ErrorState error={profits.error} onRetry={() => void profits.refetch()} />
          ) : watchlistMode && !profits.isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Star className="h-8 w-8" />
              <p>Your watchlist is empty. Star recipes on the dashboard to track them here.</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <ProfitTable
                rows={rows}
                isLoading={profits.isLoading}
                selectedRecipeId={selectedRecipeId}
                onSelect={setSelectedRecipeId}
              />
            </div>
          )}
        </div>
      </main>

      {selectedRecipeId !== null && (
        <RecipeDetailsPanel
          recipeId={selectedRecipeId}
          filters={debouncedFilters}
          onClose={() => setSelectedRecipeId(null)}
          onEdit={onEditRecipe}
        />
      )}
    </div>
  )
}
