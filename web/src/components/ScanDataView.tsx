import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useScanItems } from '@/hooks/queries'
import { formatGold, formatNumber, formatRelativeTime } from '@/lib/format'
import type { Snapshot } from '@/lib/types'
import { ErrorState } from './ErrorState'

const PAGE_SIZE = 50

export function ScanDataView({ snapshot }: { snapshot: Snapshot | null }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const result = useScanItems(snapshot?.id, search, offset, PAGE_SIZE)
  const page = result.data
  const pageCount = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">Auction Scan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot
              ? `${snapshot.region} · ${formatNumber(snapshot.auctionCount)} listings · ${formatNumber(snapshot.itemCount)} items · ${formatRelativeTime(snapshot.fetchedAt)}`
              : 'No imported auction scan'}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search item name or ID"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
          />
        </div>
      </header>

      {!snapshot ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Import a Classic Forever SavedVariables scan to view item prices.
        </div>
      ) : result.isError ? (
        <div className="p-6">
          <ErrorState error={result.error} onRetry={() => void result.refetch()} />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-28">Item ID</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Lowest</TableHead>
                  <TableHead className="text-right">Market avg</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Listings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.isLoading && !page ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading scan…</TableCell></TableRow>
                ) : page?.items.length ? page.items.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.itemId}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatGold(item.minUnitPrice, true)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatGold(item.marketUnitPrice, true)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatGold(item.medianUnitPrice, true)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.totalQuantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.listingCount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No scanned items match this search.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <footer className="flex items-center justify-between border-t px-6 py-3 text-sm text-muted-foreground">
            <span>{page ? `${formatNumber(page.total)} items · Page ${currentPage} of ${pageCount}` : 'Loading scan items…'}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={!page || offset === 0 || result.isFetching}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={!page || offset + PAGE_SIZE >= page.total || result.isFetching}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                <ChevronRight />
              </Button>
            </div>
          </footer>
        </>
      )}
    </main>
  )
}