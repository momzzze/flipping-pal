import { FlaskConical, RefreshCw, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useConnectedRealms, useDataMutations, useModifiers, useProfessions, useUpdateModifiers } from '@/hooks/queries'
import { formatNumber, formatRelativeTime, formatShare } from '@/lib/format'
import type { CraftingModifiers, Status } from '@/lib/types'
import { DataModeBadge } from './TopNav'
import { InlineError } from './ErrorState'

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

const MODIFIER_FIELDS: Array<{ key: keyof CraftingModifiers; label: string; hint: string }> = [
  { key: 'multicraftChance', label: 'Multicraft chance (%)', hint: 'Chance a craft procs extra items.' },
  { key: 'multicraftYieldBonus', label: 'Multicraft extra yield (%)', hint: 'Average extra output on a proc, as % of base output.' },
  { key: 'resourcefulnessChance', label: 'Resourcefulness chance (%)', hint: 'Chance per reagent to save materials.' },
  { key: 'resourcefulnessSavings', label: 'Resourcefulness savings (%)', hint: 'Average share of reagents saved on proc.' },
]

function ModifiersForm({ professionId, initial }: { professionId: number; initial: CraftingModifiers }) {
  const update = useUpdateModifiers()
  const [values, setValues] = useState<Record<keyof CraftingModifiers, string>>({
    multicraftChance: String(+(initial.multicraftChance * 100).toFixed(2)),
    multicraftYieldBonus: String(+(initial.multicraftYieldBonus * 100).toFixed(2)),
    resourcefulnessChance: String(+(initial.resourcefulnessChance * 100).toFixed(2)),
    resourcefulnessSavings: String(+(initial.resourcefulnessSavings * 100).toFixed(2)),
  })
  const parsed: CraftingModifiers = {
    multicraftChance: Number(values.multicraftChance) / 100,
    multicraftYieldBonus: Number(values.multicraftYieldBonus) / 100,
    resourcefulnessChance: Number(values.resourcefulnessChance) / 100,
    resourcefulnessSavings: Number(values.resourcefulnessSavings) / 100,
  }
  const invalid = Object.entries(parsed).some(
    ([key, value]) => !Number.isFinite(value) || value < 0 || (key !== 'multicraftYieldBonus' && value > 1) || value > 10,
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!invalid) update.mutate({ professionId, modifiers: parsed })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {MODIFIER_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type="number"
              step="0.1"
              min={0}
              value={values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            />
            <p className="text-[0.7rem] text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>
      {invalid && <p className="text-xs text-destructive">Chances and savings must be 0–100%; extra yield 0–1000%.</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={invalid || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save modifiers'}
        </Button>
        {update.isSuccess && <span className="text-xs text-success">Saved.</span>}
        <InlineError error={update.error} />
      </div>
    </form>
  )
}

export function SettingsView({ status }: { status: Status | undefined }) {
  const professions = useProfessions()
  const realms = useConnectedRealms()
  const mutations = useDataMutations()
  const [professionId, setProfessionId] = useState<number | undefined>(undefined)
  const activeProfessionId = professionId ?? professions.data?.[0]?.id
  const modifiers = useModifiers(activeProfessionId)
  const [realmId, setRealmId] = useState<string>('')

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Data status</CardTitle>
          <CardDescription>Where the numbers on the dashboard come from.</CardDescription>
        </CardHeader>
        <CardContent>
          <KeyValue label="Region">{status?.region ?? '—'}</KeyValue>
          <KeyValue label="Target expansion">{status?.targetExpansionName ?? '—'}</KeyValue>
          <KeyValue label="Blizzard API credentials">
            {status?.blizzardConfigured ? <Badge variant="success">Configured</Badge> : <Badge variant="secondary">Missing</Badge>}
          </KeyValue>
          <KeyValue label="Price data">
            <DataModeBadge status={status} />
          </KeyValue>
          <KeyValue label="Commodity snapshot">
            {status?.commoditySnapshot
              ? `${formatRelativeTime(status.commoditySnapshot.fetchedAt)} · ${formatNumber(status.commoditySnapshot.auctionCount)} auctions`
              : '—'}
          </KeyValue>
          <KeyValue label="Last live snapshot">{formatRelativeTime(status?.lastLiveSnapshot?.fetchedAt)}</KeyValue>
          <KeyValue label="Recipes (complete / total)">
            {status ? `${status.recipes.complete} / ${status.recipes.total}` : '—'}
          </KeyValue>
          <KeyValue label="AH cut">{status ? formatShare(status.ahCutRate) : '—'}</KeyValue>
          <KeyValue label="Auto refresh">
            {status?.autoRefreshMinutes ? `every ${status.autoRefreshMinutes} min` : 'disabled'}
          </KeyValue>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!status?.blizzardConfigured || mutations.sync.isPending}
              onClick={() => mutations.sync.mutate(undefined)}
            >
              <RefreshCw className={mutations.sync.isPending ? 'animate-spin' : ''} />
              {mutations.sync.isPending ? 'Syncing…' : 'Import Alchemy + refresh prices'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!status?.blizzardConfigured || mutations.refreshCommodities.isPending}
              onClick={() => mutations.refreshCommodities.mutate(true)}
            >
              Force commodity refresh
            </Button>
          </div>
          {mutations.sync.data && (
            <p className="mt-2 text-xs text-muted-foreground">
              Imported {mutations.sync.data.recipes.imported}/{mutations.sync.data.recipes.total} recipes (
              {mutations.sync.data.recipes.incomplete} incomplete, {mutations.sync.data.recipes.skippedManual} manual kept).
              Prices: {mutations.sync.data.auctions.status}.
            </p>
          )}
          <InlineError error={mutations.sync.error ?? mutations.refreshCommodities.error} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crafting modifiers</CardTitle>
          <CardDescription>
            Your character&apos;s stats. Applied only to recipes flagged as multicraft / resourcefulness eligible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(professions.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Import a profession or load sample data first.</p>
          ) : (
            <>
              <Select value={activeProfessionId ? String(activeProfessionId) : undefined} onValueChange={(value) => setProfessionId(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Profession" />
                </SelectTrigger>
                <SelectContent>
                  {professions.data?.map((profession) => (
                    <SelectItem key={profession.id} value={String(profession.id)}>
                      {profession.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modifiers.data && activeProfessionId !== undefined && (
                <ModifiersForm key={`${activeProfessionId}-${modifiers.dataUpdatedAt}`} professionId={activeProfessionId} initial={modifiers.data} />
              )}
              <InlineError error={modifiers.error} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected realms</CardTitle>
          <CardDescription>
            Most crafting goods are region-wide commodities. Realm auctions are only needed for non-commodity items (e.g. gear).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!status?.blizzardConfigured || mutations.syncRealms.isPending}
              onClick={() => mutations.syncRealms.mutate()}
            >
              {mutations.syncRealms.isPending ? 'Syncing…' : 'Sync EU realm list'}
            </Button>
            <span className="text-xs text-muted-foreground">{formatNumber(realms.data?.length ?? 0)} realms known</span>
          </div>
          {(realms.data?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <Select value={realmId || undefined} onValueChange={setRealmId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select connected realm" />
                </SelectTrigger>
                <SelectContent>
                  {realms.data?.map((realm) => (
                    <SelectItem key={realm.id} value={String(realm.id)}>
                      {realm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!realmId || mutations.refreshRealm.isPending}
                onClick={() => mutations.refreshRealm.mutate(Number(realmId))}
              >
                {mutations.refreshRealm.isPending ? 'Fetching…' : 'Fetch realm auctions'}
              </Button>
            </div>
          )}
          {mutations.refreshRealm.data && (
            <p className="text-xs text-muted-foreground">Realm auctions: {mutations.refreshRealm.data.status}.</p>
          )}
          <InlineError error={mutations.syncRealms.error ?? mutations.refreshRealm.error} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample data</CardTitle>
          <CardDescription>
            Fictional “[Sample]” recipes and prices for exploring the app without API credentials. Never shown as live data;
            live snapshots always take precedence.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={mutations.loadSample.isPending} onClick={() => mutations.loadSample.mutate()}>
            <FlaskConical /> {mutations.loadSample.isPending ? 'Loading…' : status?.sampleDataLoaded ? 'Reload sample data' : 'Load sample data'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!status?.sampleDataLoaded || mutations.clearSample.isPending}
            onClick={() => mutations.clearSample.mutate()}
          >
            <Trash2 /> {mutations.clearSample.isPending ? 'Removing…' : 'Remove sample data'}
          </Button>
          <InlineError error={mutations.loadSample.error ?? mutations.clearSample.error} />
        </CardContent>
      </Card>
    </div>
  )
}
