import { AlertTriangle, FlaskConical, Pencil, Star, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecipeBreakdown, useRecipeHistory, useWatchlistToggle } from '@/hooks/queries'
import { formatNumber, formatPercent, formatShare, formatRelativeTime } from '@/lib/format'
import type { Filters } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ErrorState } from './ErrorState'
import { GoldAmount } from './GoldAmount'
import { ItemIcon, ItemName } from './ItemDisplay'
import { Sparkline } from './Sparkline'

interface RecipeDetailsPanelProps {
  recipeId: number
  filters: Filters
  onClose: () => void
  onEdit: (recipeId: number) => void
}

function Row({ label, children, emphasis }: { label: string; children: ReactNode; emphasis?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-1 text-sm', emphasis && 'border-t pt-2 font-semibold')}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function RecipeDetailsPanel({ recipeId, filters, onClose, onEdit }: RecipeDetailsPanelProps) {
  const breakdown = useRecipeBreakdown(recipeId, {
    crafts: filters.crafts,
    sellPriceStrategy: filters.sellPriceStrategy,
    realmId: filters.realmId,
  })
  const history = useRecipeHistory(recipeId)
  const watch = useWatchlistToggle()
  const data = breakdown.data

  return (
    <aside className="flex w-[26rem] shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Recipe details</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <X />
        </Button>
      </div>

      {breakdown.isLoading && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {breakdown.isError && (
        <div className="p-4">
          <ErrorState error={breakdown.error} onRetry={() => void breakdown.refetch()} />
        </div>
      )}

      {data && (
        <div className={cn('space-y-5 p-4', breakdown.isFetching && 'opacity-70')}>
          <div className="flex items-start gap-3">
            <ItemIcon item={data.recipe.outputItem} size={44} />
            <div className="min-w-0 flex-1">
              {data.recipe.outputItem ? (
                <ItemName item={data.recipe.outputItem} className="text-base" />
              ) : (
                <p className="font-semibold">{data.recipe.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {data.recipe.professionName}
                {data.recipe.skillTierName ? ` · ${data.recipe.skillTierName}` : ''}
                {data.recipe.category ? ` · ${data.recipe.category}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {data.dataMode === 'SAMPLE' && (
                  <Badge variant="warning">
                    <FlaskConical className="h-3 w-3" /> Sample prices
                  </Badge>
                )}
                {data.recipe.manuallyEdited && <Badge variant="secondary">Manually corrected</Badge>}
                {!data.recipe.isComplete && <Badge variant="destructive">Incomplete mapping</Badge>}
                {data.recipe.multicraftEligible && <Badge variant="outline">Multicraft</Badge>}
                {data.recipe.resourcefulnessEligible && <Badge variant="outline">Resourcefulness</Badge>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={data.watchlisted ? 'secondary' : 'outline'}
              disabled={watch.isPending}
              onClick={() => watch.mutate({ recipeId, watch: !data.watchlisted })}
            >
              <Star className={cn(data.watchlisted && 'fill-primary text-primary')} />
              {data.watchlisted ? 'Watching' : 'Watch'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(recipeId)}>
              <Pencil /> Edit recipe
            </Button>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Materials · {formatNumber(data.result.crafts)} craft{data.result.crafts === 1 ? '' : 's'}
            </h3>
            {data.reagents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reagents mapped. Edit the recipe to add them.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Reagent</th>
                      <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-2 py-1.5 text-right font-medium">Avg price</th>
                      <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reagents.map((reagent) => (
                      <tr key={reagent.item.id} className="border-t align-top">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <ItemIcon item={reagent.item} size={22} />
                            <div className="min-w-0">
                              <ItemName item={reagent.item} className="text-xs" />
                              <p className="text-[0.65rem] text-muted-foreground">
                                {reagent.quantityPerCraft}/craft · supply {formatNumber(reagent.supply)} (
                                {formatNumber(reagent.listings)} listings)
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                          {formatNumber(reagent.requiredQuantity)}
                          {reagent.isOptional && <span className="block text-[0.6rem] text-muted-foreground">optional</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          <GoldAmount copper={reagent.averageUnitPrice} />
                          {reagent.marginalUnitPrice !== null &&
                            reagent.minUnitPrice !== null &&
                            reagent.marginalUnitPrice > reagent.minUnitPrice && (
                              <span className="block text-[0.6rem] text-muted-foreground" title="Highest price tier reached">
                                up to <GoldAmount copper={reagent.marginalUnitPrice} />
                              </span>
                            )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          <GoldAmount copper={reagent.totalCost} />
                          {reagent.isFullyFilled === false && (
                            <span className="flex items-center justify-end gap-1 text-[0.6rem] text-warning">
                              <AlertTriangle className="h-3 w-3" /> exceeds supply
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-md border p-3">
            <Row label="Material cost">
              <GoldAmount copper={data.result.materialCost} />
            </Row>
            <Row label={`Expected output (${formatNumber(data.result.expectedOutputQuantity)} units)`}>
              <span className="text-xs text-muted-foreground">
                @ <GoldAmount copper={data.result.sellUnitPrice} /> {data.sellPriceStrategy === 'MIN' ? 'lowest' : 'market'}
              </span>
            </Row>
            <Row label="Gross revenue">
              <GoldAmount copper={data.result.grossRevenue} />
            </Row>
            <Row label={`AH cut (${formatShare(data.ahCutRate)})`}>
              <GoldAmount copper={data.result.ahFee !== null ? -data.result.ahFee : null} className="text-muted-foreground" />
            </Row>
            <Row label="Net profit" emphasis>
              <GoldAmount copper={data.result.netProfit} signed />
            </Row>
            <Row label="Profit per craft">
              <GoldAmount copper={data.result.netProfitPerCraft} signed />
            </Row>
            <Row label="ROI">
              <span
                className={cn(
                  'font-mono tabular-nums',
                  data.result.roi === null ? 'text-muted-foreground' : data.result.roi >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {formatPercent(data.result.roi !== null ? data.result.roi * 100 : null)}
              </span>
            </Row>
            {(data.result.missingReagentPrices.length > 0 || data.result.missingOutputPrice) && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.result.missingOutputPrice
                  ? 'The crafted item has no current listings, so revenue cannot be estimated.'
                  : `${data.result.missingReagentPrices.length} reagent(s) have no current listings, so cost is unknown.`}
              </p>
            )}
            {data.recipe.multicraftEligible || data.recipe.resourcefulnessEligible ? (
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                Includes your modifiers: multicraft {formatShare(data.modifiers.multicraftChance, 1)}, resourcefulness{' '}
                {formatShare(data.modifiers.resourcefulnessChance, 1)}.
              </p>
            ) : null}
          </section>

          {data.output && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Output market</h3>
              {data.output.price ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Lowest listing">
                    <GoldAmount copper={data.output.price.minUnitPrice} />
                  </Stat>
                  <Stat label="Market (cheapest 10%)">
                    <GoldAmount copper={data.output.price.marketUnitPrice} />
                  </Stat>
                  <Stat label="Supply listed">{formatNumber(data.output.price.totalQuantity)}</Stat>
                  <Stat label="Listings">{formatNumber(data.output.price.listingCount)}</Stat>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No current listings for this item.</p>
              )}
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                Supply counts what is currently listed, not what sells. Active listings are not confirmed sales.
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Profit history (per craft)
            </h3>
            {history.isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : history.isError ? (
              <p className="text-xs text-destructive">Could not load history.</p>
            ) : (
              <>
                <Sparkline values={history.data?.points.map((point) => point.netProfit) ?? []} />
                {history.data && history.data.points.length > 0 && (
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {history.data.points.length} snapshots
                    {history.data.dataMode === 'SAMPLE' ? ' (sample)' : ''} · latest{' '}
                    {formatRelativeTime(history.data.points[history.data.points.length - 1].fetchedAt)}
                  </p>
                )}
              </>
            )}
          </section>

          {data.recipe.notes && (
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Notes</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{data.recipe.notes}</p>
            </section>
          )}
        </div>
      )}
    </aside>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-card/50 px-2.5 py-1.5">
      <p className="text-[0.65rem] text-muted-foreground uppercase">{label}</p>
      <div className="font-mono text-sm tabular-nums">{children}</div>
    </div>
  )
}
