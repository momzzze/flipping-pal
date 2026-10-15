import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useItemSearch } from '@/hooks/queries'
import type { Item } from '@/lib/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ItemIcon, ItemName } from './ItemDisplay'

interface ItemPickerProps {
  placeholder?: string
  onPick: (item: Pick<Item, 'id'> & Partial<Item>) => void
}

/**
 * Search known items by name or ID. A numeric ID that is not known locally can still be
 * picked; the API then imports it from Blizzard (or creates a placeholder).
 */
export function ItemPicker({ placeholder = 'Search item name or enter item ID…', onPick }: ItemPickerProps) {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const results = useItemSearch(debounced)
  const numericId = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null
  const showDropdown = query.trim().length >= 2 || numericId !== null

  const pick = (item: Pick<Item, 'id'> & Partial<Item>) => {
    onPick(item)
    setQuery('')
  }

  return (
    <div className="relative">
      <Input value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} />
      {showDropdown && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {results.isFetching && <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>}
          {results.data?.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => pick(item)}
            >
              <ItemIcon item={item} size={20} />
              <ItemName item={item} />
              <span className="ml-auto text-xs text-muted-foreground">#{item.id}</span>
            </button>
          ))}
          {numericId !== null && !results.data?.some((item) => item.id === numericId) && (
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => pick({ id: numericId })}
            >
              Use item ID <span className="font-mono">#{numericId}</span> (imported from Blizzard when available)
            </button>
          )}
          {!results.isFetching && results.data?.length === 0 && numericId === null && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No known items match. Enter a numeric item ID instead.</p>
          )}
        </div>
      )}
    </div>
  )
}
