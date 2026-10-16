import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, FlaskConical, Pencil, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWatchlistToggle } from '@/hooks/queries'
import { formatNumber, formatPercent } from '@/lib/format'
import type { ProfitRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GoldAmount } from './GoldAmount'
import { ItemIcon, ItemName } from './ItemDisplay'

const column = createColumnHelper<ProfitRow>()

function RoiBar({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-muted-foreground">—</span>
  const width = Math.min(100, Math.abs(roi))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full', roi >= 0 ? 'bg-success' : 'bg-destructive')} style={{ width: `${width}%` }} />
      </div>
      <span className={cn('font-mono text-xs tabular-nums', roi >= 0 ? 'text-success' : 'text-destructive')}>
        {formatPercent(roi)}
      </span>
    </div>
  )
}

interface ProfitTableProps {
  rows: ProfitRow[]
  isLoading: boolean
  selectedRecipeId: number | null
  onSelect: (recipeId: number) => void
}

export function ProfitTable({ rows, isLoading, selectedRecipeId, onSelect }: ProfitTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'netProfit', desc: true }])
  const { mutate: toggleWatch } = useWatchlistToggle()

  const columns = useMemo(
    () => [
      column.display({
        id: 'watch',
        header: () => <Star className="h-3.5 w-3.5" />,
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={row.original.watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            onClick={(event) => {
              event.stopPropagation()
              toggleWatch({ recipeId: row.original.recipeId, watch: !row.original.watchlisted })
            }}
            className="text-muted-foreground hover:text-primary"
          >
            <Star className={cn('h-4 w-4', row.original.watchlisted && 'fill-primary text-primary')} />
          </button>
        ),
      }),
      column.accessor('recipeName', {
        header: 'Recipe',
        sortingFn: 'alphanumeric',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex min-w-56 items-center gap-2.5">
              <ItemIcon item={r.outputItem} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {r.outputItem ? <ItemName item={r.outputItem} /> : <span className="font-medium">{r.recipeName}</span>}
                  {r.outputQuantityPerCraft !== 1 && (
                    <span className="text-xs text-muted-foreground">×{r.outputQuantityPerCraft}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{r.category ?? r.professionName}</span>
                  {r.source === 'SAMPLE' && (
                    <Badge variant="warning" className="px-1 py-0 text-[0.6rem]">
                      <FlaskConical className="h-2.5 w-2.5" /> sample
                    </Badge>
                  )}
                  {r.source === 'FOREVER_BETA' && (
                    <Badge variant="outline" className="px-1 py-0 text-[0.6rem]">
                      Classic Forever
                    </Badge>
                  )}
                  {r.manuallyEdited && (
                    <span title="Manually corrected recipe">
                      <Pencil className="h-3 w-3" />
                    </span>
                  )}
                  {!r.isComplete && <Badge variant="destructive" className="px-1 py-0 text-[0.6rem]">incomplete</Badge>}
                </div>
              </div>
            </div>
          )
        },
      }),
      column.accessor((r) => r.materialCost ?? undefined, {
        id: 'materialCost',
        sortUndefined: 'last',
        header: 'Material cost',
        cell: ({ row }) =>
          row.original.missingReagentPrices > 0 ? (
            <span className="text-xs text-muted-foreground">{row.original.missingReagentPrices} price(s) missing</span>
          ) : (
            <span className="flex items-center gap-1">
              <GoldAmount copper={row.original.materialCost} compact />
              {row.original.insufficientReagentSupply && (
                <span title="Not enough reagent supply listed for this many crafts">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                </span>
              )}
            </span>
          ),
      }),
      column.accessor((r) => r.sellUnitPrice ?? undefined, {
        id: 'sellUnitPrice',
        sortUndefined: 'last',
        header: 'Sell price',
        cell: ({ row }) => <GoldAmount copper={row.original.sellUnitPrice} compact />,
      }),
      column.accessor((r) => r.ahFee ?? undefined, {
        id: 'ahFee',
        sortUndefined: 'last',
        header: 'AH fee',
        cell: ({ row }) => <GoldAmount copper={row.original.ahFee} compact className="text-muted-foreground" />,
      }),
      column.accessor((r) => r.netProfit ?? undefined, {
        id: 'netProfit',
        sortUndefined: 'last',
        header: 'Net profit',
        cell: ({ row }) => <GoldAmount copper={row.original.netProfit} compact signed className="font-semibold" />,
      }),
      column.accessor((r) => r.roiPercent ?? undefined, {
        id: 'roiPercent',
        sortUndefined: 'last',
        header: 'ROI',
        cell: ({ row }) => <RoiBar roi={row.original.roiPercent} />,
      }),
      column.accessor((r) => r.outputSupply ?? undefined, {
        id: 'outputSupply',
        sortUndefined: 'last',
        header: () => <span title="Units of the crafted item currently listed on the AH. Supply is not demand.">Supply</span>,
        cell: ({ row }) => (
          <div className="font-mono text-xs tabular-nums">
            <div>{formatNumber(row.original.outputSupply)}</div>
            <div className="text-muted-foreground">{formatNumber(row.original.outputListings)} listings</div>
          </div>
        ),
      }),
      column.accessor((r) => r.maxCraftsFromSupply ?? undefined, {
        id: 'maxCraftsFromSupply',
        sortUndefined: 'last',
        header: () => <span title="Crafts coverable by currently listed reagent supply">Reagent depth</span>,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">{formatNumber(row.original.maxCraftsFromSupply)}</span>
        ),
      }),
    ],
    [toggleWatch],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
  })

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-card">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted()
              const canSort = header.column.getCanSort()
              return (
                <TableHead key={header.id}>
                  {canSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' ? <ArrowUp className="h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading &&
          Array.from({ length: 8 }, (_, index) => (
            <TableRow key={`skeleton-${index}`}>
              {columns.map((_, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        {!isLoading && rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
              No recipes match the current filters.
            </TableCell>
          </TableRow>
        )}
        {!isLoading &&
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.original.recipeId === selectedRecipeId ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(row.original.recipeId)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}
