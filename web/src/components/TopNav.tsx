import { Database, FlaskConical, LayoutDashboard, ListChecks, RefreshCw, Settings, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDataMutations } from '@/hooks/queries'
import { formatRelativeTime } from '@/lib/format'
import type { Status } from '@/lib/types'
import { cn } from '@/lib/utils'
import { InlineError } from './ErrorState'

export type View = 'dashboard' | 'watchlist' | 'scan' | 'recipes' | 'settings'

const NAV: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'watchlist', label: 'Watchlist', icon: Star },
  { view: 'scan', label: 'Scan Data', icon: Database },
  { view: 'recipes', label: 'Recipes', icon: ListChecks },
  { view: 'settings', label: 'Settings', icon: Settings },
]

export function DataModeBadge({ status }: { status: Status | undefined }) {
  if (!status) return <Badge variant="secondary">Loading…</Badge>
  if (status.dataMode === 'LIVE') {
    return (
      <Badge variant="success" title={`Snapshot fetched ${status.commoditySnapshot?.fetchedAt ?? ''}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> LIVE · {formatRelativeTime(status.commoditySnapshot?.fetchedAt)}
      </Badge>
    )
  }
  if (status.dataMode === 'SAMPLE') {
    return (
      <Badge variant="warning" title="Fictional demo prices – not live market data">
        <FlaskConical className="h-3 w-3" /> SAMPLE DATA
      </Badge>
    )
  }
  if (status.dataMode === 'SCAN') {
    return (
      <Badge variant="outline" title={`Auction scan imported ${status.latestScanSnapshot?.fetchedAt ?? ''}`}>
        <Database className="h-3 w-3" /> SCAN DATA
      </Badge>
    )
  }
  return <Badge variant="secondary">NO PRICE DATA</Badge>
}

export function TopNav({ view, onViewChange, status }: { view: View; onViewChange: (view: View) => void; status: Status | undefined }) {
  const { refreshCommodities, sync } = useDataMutations()
  const configured = status?.blizzardConfigured ?? false

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-sidebar px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary/10 font-serif text-sm font-bold text-primary">
          AF
        </div>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">Azeroth Flip</p>
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Crafting profit analyzer</p>
        </div>
      </div>

      <nav className="ml-4 flex items-center gap-1">
        {NAV.map(({ view: target, label, icon: Icon }) => (
          <Button
            key={target}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(target)}
            className={cn(view === target && 'bg-accent text-primary')}
          >
            <Icon /> {label}
          </Button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <InlineError error={refreshCommodities.error ?? sync.error} />
        <Badge variant="outline">
          <Database className="h-3 w-3" /> {status?.targetExpansionName ?? 'Classic Forever'}
        </Badge>
        <DataModeBadge status={status} />
        {configured && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={refreshCommodities.isPending}
              onClick={() => refreshCommodities.mutate(false)}
              title="Fetch the latest EU commodity auctions from Blizzard"
            >
              <RefreshCw className={cn(refreshCommodities.isPending && 'animate-spin')} />
              {refreshCommodities.isPending ? 'Refreshing…' : 'Refresh prices'}
            </Button>
            <Button
              size="sm"
              disabled={sync.isPending}
              onClick={() => sync.mutate(undefined)}
              title="Import Alchemy recipes and refresh commodity prices"
            >
              <RefreshCw className={cn(sync.isPending && 'animate-spin')} />
              {sync.isPending ? 'Syncing…' : 'Sync Alchemy'}
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
