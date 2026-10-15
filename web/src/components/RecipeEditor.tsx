import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecipeMutations, useRecipes } from '@/hooks/queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { Item, Recipe, RecipeUpdate } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ErrorState, InlineError } from './ErrorState'
import { ItemIcon, ItemName } from './ItemDisplay'
import { ItemPicker } from './ItemPicker'

type PickedItem = Pick<Item, 'id'> & Partial<Item>

interface ReagentDraft {
  item: PickedItem
  quantity: number
  isOptional: boolean
}

function ItemLabel({ item }: { item: PickedItem }) {
  if (item.name && item.quality) {
    return (
      <span className="flex items-center gap-2">
        <ItemIcon item={{ name: item.name, quality: item.quality, iconUrl: item.iconUrl ?? null }} size={22} />
        <ItemName item={{ name: item.name, quality: item.quality, craftingQuality: item.craftingQuality ?? null }} />
        <span className="text-xs text-muted-foreground">#{item.id}</span>
      </span>
    )
  }
  return <span className="font-mono text-sm">Item #{item.id} (will be imported)</span>
}

function RecipeForm({ recipe }: { recipe: Recipe }) {
  const { update, reset } = useRecipeMutations()
  const [name, setName] = useState(recipe.name)
  const [category, setCategory] = useState(recipe.category ?? '')
  const [output, setOutput] = useState<PickedItem | null>(recipe.outputItem)
  const [qtyMin, setQtyMin] = useState(recipe.outputQuantityMin)
  const [qtyMax, setQtyMax] = useState(recipe.outputQuantityMax)
  const [multicraft, setMulticraft] = useState(recipe.multicraftEligible)
  const [resourcefulness, setResourcefulness] = useState(recipe.resourcefulnessEligible)
  const [concentration, setConcentration] = useState(recipe.concentrationEligible)
  const [notes, setNotes] = useState(recipe.notes ?? '')
  const [reagents, setReagents] = useState<ReagentDraft[]>(
    recipe.reagents.map((reagent) => ({ item: reagent.item, quantity: reagent.quantity, isOptional: reagent.isOptional })),
  )
  const [saved, setSaved] = useState(false)

  const quantityError = qtyMin < 1 || qtyMax < qtyMin ? 'Output quantity max must be ≥ min ≥ 1.' : null
  const duplicate = new Set(reagents.map((reagent) => reagent.item.id)).size !== reagents.length

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (quantityError || duplicate) return
    const payload: RecipeUpdate = {
      name: name.trim() || recipe.name,
      category: category.trim(),
      outputItemId: output?.id ?? null,
      outputQuantityMin: qtyMin,
      outputQuantityMax: qtyMax,
      multicraftEligible: multicraft,
      resourcefulnessEligible: resourcefulness,
      concentrationEligible: concentration,
      notes,
      reagents: reagents.map((reagent) => ({
        itemId: reagent.item.id,
        quantity: reagent.quantity,
        isOptional: reagent.isOptional,
      })),
    }
    setSaved(false)
    update.mutate({ id: recipe.id, update: payload }, { onSuccess: () => setSaved(true) })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{recipe.source}</Badge>
        {recipe.blizzardRecipeId && <Badge variant="outline">Blizzard recipe #{recipe.blizzardRecipeId}</Badge>}
        {recipe.manuallyEdited && <Badge variant="secondary">Manually corrected — protected from re-import</Badge>}
        {!recipe.isComplete && <Badge variant="destructive">Incomplete</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="recipe-name">Name</Label>
          <Input id="recipe-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipe-category">Category</Label>
          <Input id="recipe-category" value={category} onChange={(event) => setCategory(event.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Output item</Label>
        <div className="flex items-center gap-3 rounded-md border p-2">
          {output ? <ItemLabel item={output} /> : <span className="text-sm text-muted-foreground">No output item mapped</span>}
          {output && (
            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setOutput(null)}>
              Clear
            </Button>
          )}
        </div>
        <ItemPicker placeholder="Change output: search name or enter item ID…" onPick={setOutput} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="qty-min">Output per craft (min)</Label>
          <Input id="qty-min" type="number" min={1} value={qtyMin} onChange={(event) => setQtyMin(Number(event.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qty-max">Output per craft (max)</Label>
          <Input id="qty-max" type="number" min={1} value={qtyMax} onChange={(event) => setQtyMax(Number(event.target.value))} />
        </div>
      </div>
      {quantityError && <p className="text-xs text-destructive">{quantityError}</p>}

      <div className="space-y-2">
        <Label>Reagents</Label>
        <div className="divide-y rounded-md border">
          {reagents.length === 0 && <p className="p-3 text-sm text-muted-foreground">No reagents.</p>}
          {reagents.map((reagent, index) => (
            <div key={reagent.item.id} className="flex items-center gap-3 p-2">
              <ItemLabel item={reagent.item} />
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={reagent.isOptional}
                  onCheckedChange={(checked) =>
                    setReagents(reagents.map((r, i) => (i === index ? { ...r, isOptional: checked === true } : r)))
                  }
                />
                optional
              </label>
              <Input
                type="number"
                min={1}
                aria-label="Quantity"
                className="w-20"
                value={reagent.quantity}
                onChange={(event) =>
                  setReagents(
                    reagents.map((r, i) =>
                      i === index ? { ...r, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : r,
                    ),
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove reagent"
                onClick={() => setReagents(reagents.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <ItemPicker
              placeholder="Add reagent: search name or enter item ID…"
              onPick={(item) =>
                setReagents((current) =>
                  current.some((r) => r.item.id === item.id) ? current : [...current, { item, quantity: 1, isOptional: false }],
                )
              }
            />
          </div>
        </div>
        {duplicate && <p className="text-xs text-destructive">Each reagent can only appear once.</p>}
        <p className="text-[0.7rem] text-muted-foreground">
          Optional reagents are excluded from cost. New items are only priced after the next price refresh.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={multicraft} onCheckedChange={(checked) => setMulticraft(checked === true)} /> Multicraft
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={resourcefulness} onCheckedChange={(checked) => setResourcefulness(checked === true)} />{' '}
          Resourcefulness
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={concentration} onCheckedChange={(checked) => setConcentration(checked === true)} /> Concentration
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recipe-notes">Notes</Label>
        <textarea
          id="recipe-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={update.isPending || !!quantityError || duplicate}>
          <Save /> {update.isPending ? 'Saving…' : 'Save correction'}
        </Button>
        {recipe.manuallyEdited && recipe.source === 'BLIZZARD' && (
          <Button type="button" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate(recipe.id)}>
            <RotateCcw /> Allow re-import
          </Button>
        )}
        {saved && !update.isPending && <span className="text-xs text-success">Saved.</span>}
        <InlineError error={update.error ?? reset.error} />
      </div>
    </form>
  )
}

export function RecipeEditor({ selectedId, onSelect }: { selectedId: number | null; onSelect: (id: number) => void }) {
  const [search, setSearch] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 250)
  const recipes = useRecipes({ search: debouncedSearch || undefined, incomplete: incompleteOnly })
  const selected = recipes.data?.find((recipe) => recipe.id === selectedId) ?? null

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-80 shrink-0 flex-col border-r bg-sidebar">
        <div className="space-y-2 border-b p-3">
          <Input placeholder="Search recipes…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={incompleteOnly} onCheckedChange={(checked) => setIncompleteOnly(checked === true)} />
            Incomplete only
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {recipes.isLoading &&
            Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="m-3 h-8" />)}
          {recipes.isError && (
            <div className="p-3">
              <ErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />
            </div>
          )}
          {recipes.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No recipes found.</p>}
          {recipes.data?.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onSelect(recipe.id)}
              className={cn(
                'flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-accent/60',
                recipe.id === selectedId && 'bg-accent',
              )}
            >
              <ItemIcon item={recipe.outputItem} size={24} />
              <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
              {!recipe.isComplete && <Badge variant="destructive">incomplete</Badge>}
              {recipe.manuallyEdited && <Badge variant="secondary">edited</Badge>}
            </button>
          ))}
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Correct recipe: {selected.name}</CardTitle>
              <CardDescription>
                {selected.professionName}
                {selected.skillTierName ? ` · ${selected.skillTierName}` : ''}. Saved corrections are marked as manual and are
                not overwritten by future Blizzard imports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecipeForm key={selected.id} recipe={selected} />
            </CardContent>
          </Card>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a recipe to review or correct its mapping.
          </div>
        )}
      </div>
    </div>
  )
}
