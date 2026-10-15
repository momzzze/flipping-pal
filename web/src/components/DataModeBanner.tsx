import { FlaskConical, Info, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDataMutations } from '@/hooks/queries'
import type { Status } from '@/lib/types'
import { InlineError } from './ErrorState'

/** Makes the data provenance impossible to miss. Sample prices are never presented as live data. */
export function DataModeBanner({ status }: { status: Status | undefined }) {
  const { loadSample, sync } = useDataMutations()
  if (!status) return null

  if (status.dataMode === 'SAMPLE') {
    return (
      <div className="flex items-center gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
        <FlaskConical className="h-4 w-4 shrink-0" />
        <p>
          <strong>SAMPLE DATA</strong> — recipes and prices shown are fictional demo values, <strong>not live Auction House data</strong>.
          {status.blizzardConfigured
            ? ' Run “Sync Alchemy” to load live EU prices.'
            : ' Add Blizzard API credentials to api/.env to use live EU prices.'}
        </p>
      </div>
    )
  }

  if (status.dataMode === 'NONE') {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b bg-accent/40 px-4 py-2 text-sm">
        {status.blizzardConfigured ? <Info className="h-4 w-4 text-primary" /> : <KeyRound className="h-4 w-4 text-primary" />}
        <p className="text-muted-foreground">
          {status.blizzardConfigured
            ? 'No auction data yet. Import Alchemy recipes and fetch EU commodity prices to get started.'
            : 'Blizzard API credentials are not configured, so live prices are unavailable. You can explore the app with clearly labeled sample data.'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <InlineError error={sync.error ?? loadSample.error} />
          {status.blizzardConfigured && (
            <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate(undefined)}>
              {sync.isPending ? 'Syncing…' : 'Sync Alchemy now'}
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={loadSample.isPending} onClick={() => loadSample.mutate()}>
            <FlaskConical /> {loadSample.isPending ? 'Loading…' : 'Load sample data'}
          </Button>
        </div>
      </div>
    )
  }
  return null
}
