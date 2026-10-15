import { RotateCcw, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useConnectedRealms, useExpansions, useProfessions } from '@/hooks/queries'
import { ITEM_QUALITIES, type Filters, type ItemQuality } from '@/lib/types'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { QUALITY_TEXT } from '@/lib/quality'
import { cn } from '@/lib/utils'

const ALL = 'all'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface FilterSidebarProps {
  filters: Filters
  onChange: (filters: Filters) => void
  hideWatchlistToggle?: boolean
}

export function FilterSidebar({ filters, onChange, hideWatchlistToggle }: FilterSidebarProps) {
  const professions = useProfessions()
  const expansions = useExpansions()
  const realms = useConnectedRealms()
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })

  const toggleQuality = (quality: ItemQuality) =>
    set(
      'quality',
      filters.quality.includes(quality) ? filters.quality.filter((q) => q !== quality) : [...filters.quality, quality],
    )

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r bg-sidebar p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
          <RotateCcw /> Reset
        </Button>
      </div>

      <Field label="Search">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Recipe name…"
            value={filters.search}
            onChange={(event) => set('search', event.target.value)}
          />
        </div>
      </Field>

      <Field label="Profession">
        <Select
          value={filters.professionId !== undefined ? String(filters.professionId) : ALL}
          onValueChange={(value) => set('professionId', value === ALL ? undefined : Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All professions</SelectItem>
            {professions.data?.map((profession) => (
              <SelectItem key={profession.id} value={String(profession.id)}>
                {profession.name} ({profession.recipeCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Expansion">
        <Select
          value={filters.expansionId !== undefined ? String(filters.expansionId) : ALL}
          onValueChange={(value) => set('expansionId', value === ALL ? undefined : Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All expansions</SelectItem>
            {expansions.data?.map((expansion) => (
              <SelectItem key={expansion.id} value={String(expansion.id)}>
                {expansion.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Output quality">
        <div className="flex flex-wrap gap-1.5">
          {ITEM_QUALITIES.map((quality) => (
            <button
              key={quality}
              type="button"
              onClick={() => toggleQuality(quality)}
              className={cn(
                'rounded border px-2 py-0.5 text-xs capitalize transition-colors',
                QUALITY_TEXT[quality],
                filters.quality.includes(quality) ? 'border-current bg-current/10' : 'border-border opacity-60 hover:opacity-100',
              )}
            >
              {quality.toLowerCase()}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Min profit/craft (g)">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="any"
            value={filters.minProfitGold ?? ''}
            onChange={(event) => set('minProfitGold', parseOptionalNumber(event.target.value))}
          />
        </Field>
        <Field label="Min ROI (%)">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="any"
            value={filters.minRoi ?? ''}
            onChange={(event) => set('minRoi', parseOptionalNumber(event.target.value))}
          />
        </Field>
      </div>

      <Field label="Min output supply" hint="Units of the crafted item currently listed (supply, not sales).">
        <Input
          type="number"
          min={0}
          placeholder="any"
          value={filters.minSupply ?? ''}
          onChange={(event) => set('minSupply', parseOptionalNumber(event.target.value))}
        />
      </Field>

      <Field label="Crafts" hint="Reagent costs walk up AH price tiers for larger batches.">
        <Input
          type="number"
          min={1}
          max={10000}
          value={filters.crafts}
          onChange={(event) => set('crafts', Math.min(10_000, Math.max(1, Math.floor(Number(event.target.value) || 1))))}
        />
      </Field>

      <Field label="Sell price">
        <Select value={filters.sellPriceStrategy} onValueChange={(value) => set('sellPriceStrategy', value as Filters['sellPriceStrategy'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MIN">Lowest listing</SelectItem>
            <SelectItem value="MARKET">Market (cheapest 10% avg)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {(realms.data?.length ?? 0) > 0 && (
        <Field label="Connected realm" hint="Used for non-commodity items not on the region-wide AH.">
          <Select
            value={filters.realmId !== undefined ? String(filters.realmId) : ALL}
            onValueChange={(value) => set('realmId', value === ALL ? undefined : Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Commodities only</SelectItem>
              {realms.data?.map((realm) => (
                <SelectItem key={realm.id} value={String(realm.id)}>
                  {realm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filters.includeIncomplete}
            onCheckedChange={(checked) => set('includeIncomplete', checked === true)}
          />
          Show incomplete recipes
        </label>
        {!hideWatchlistToggle && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filters.watchlistOnly} onCheckedChange={(checked) => set('watchlistOnly', checked === true)} />
            Watchlist only
          </label>
        )}
      </div>
    </aside>
  )
}
