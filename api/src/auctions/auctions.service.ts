import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuctionScope, AuctionSnapshot, Prisma } from '@prisma/client';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { CacheService } from '../common/cache.service';
import { toPrismaRegion } from '../common/region';
import { ItemsService } from '../items/items.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  aggregateListings,
  ItemPriceAggregate,
  Listing,
} from './auction-aggregation';

export interface RefreshResult {
  status: 'updated' | 'not-modified' | 'no-tracked-items';
  snapshot: SnapshotDto | null;
  trackedItems: number;
  pricedItems: number;
}

export interface SnapshotDto {
  id: number;
  region: string;
  scope: AuctionScope;
  connectedRealmId: number | null;
  isSample: boolean;
  source: string;
  fetchedAt: string;
  sourceLastModified: string | null;
  auctionCount: number;
  itemCount: number;
}

export interface SnapshotItemDto {
  itemId: number;
  itemName: string;
  minUnitPrice: number;
  marketUnitPrice: number;
  medianUnitPrice: number;
  totalQuantity: number;
  listingCount: number;
}

export function toSnapshotDto(snapshot: AuctionSnapshot): SnapshotDto {
  return {
    id: snapshot.id,
    region: snapshot.region,
    scope: snapshot.scope,
    connectedRealmId: snapshot.connectedRealmId,
    isSample: snapshot.isSample,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    sourceLastModified: snapshot.sourceLastModified?.toISOString() ?? null,
    auctionCount: snapshot.auctionCount,
    itemCount: snapshot.itemCount,
  };
}

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);
  private readonly running = new Map<string, Promise<RefreshResult>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
    private readonly items: ItemsService,
    private readonly cache: CacheService,
  ) {}

  /** Pulls region-wide commodity auctions and stores a snapshot for all tracked (recipe) items. */
  refreshCommodities(force = false): Promise<RefreshResult> {
    return this.singleFlight('commodities', () =>
      this.doRefresh(AuctionScope.COMMODITY, null, force),
    );
  }

  /** Pulls a connected realm's (non-commodity) auctions. */
  refreshRealm(
    connectedRealmId: number,
    force = false,
  ): Promise<RefreshResult> {
    return this.singleFlight(`realm:${connectedRealmId}`, () =>
      this.doRefresh(AuctionScope.REALM, connectedRealmId, force),
    );
  }

  async listSnapshots(limit = 50): Promise<SnapshotDto[]> {
    const snapshots = await this.prisma.auctionSnapshot.findMany({
      where: { region: toPrismaRegion(this.blizzard.region) },
      orderBy: { fetchedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return snapshots.map(toSnapshotDto);
  }

  async listSnapshotItems(
    snapshotId: number,
    options: { search?: string; limit?: number; offset?: number } = {},
  ) {
    const snapshot = await this.prisma.auctionSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) throw new NotFoundException(`Snapshot ${snapshotId} not found`);

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const search = options.search?.trim();
    const numericId = search && /^\d+$/.test(search) ? Number(search) : undefined;
    const where: Prisma.ItemPriceSnapshotWhereInput = {
      snapshotId,
      ...(search
        ? {
            item: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                ...(numericId ? [{ id: numericId }] : []),
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.itemPriceSnapshot.count({ where }),
      this.prisma.itemPriceSnapshot.findMany({
        where,
        include: { item: { select: { name: true } } },
        orderBy: { itemId: 'asc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      snapshot: toSnapshotDto(snapshot),
      total,
      limit,
      offset,
      items: rows.map((row): SnapshotItemDto => ({
        itemId: row.itemId,
        itemName: row.item.name,
        minUnitPrice: Number(row.minUnitPrice),
        marketUnitPrice: Number(row.marketUnitPrice),
        medianUnitPrice: Number(row.medianUnitPrice),
        totalQuantity: row.totalQuantity,
        listingCount: row.listingCount,
      })),
    };
  }

  async listConnectedRealms() {
    return this.prisma.connectedRealm.findMany({
      where: { region: toPrismaRegion(this.blizzard.region) },
      orderBy: { name: 'asc' },
    });
  }

  async syncConnectedRealms(): Promise<{ count: number }> {
    const index = await this.blizzard.getConnectedRealmIndex();
    const ids = index.connected_realms
      .map((ref) => /connected-realm\/(\d+)/.exec(ref.href)?.[1])
      .filter((id): id is string => id !== undefined)
      .map(Number);
    const region = toPrismaRegion(this.blizzard.region);
    await Promise.all(
      ids.map(async (id) => {
        const detail = await this.blizzard.getConnectedRealm(id);
        const names = detail.realms.map((realm) => realm.name).sort();
        const data = {
          region,
          name: names.join(' / '),
          realmSlugs: detail.realms.map((realm) => realm.slug),
        };
        await this.prisma.connectedRealm.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
      }),
    );
    return { count: ids.length };
  }

  private singleFlight(
    key: string,
    task: () => Promise<RefreshResult>,
  ): Promise<RefreshResult> {
    const existing = this.running.get(key);
    if (existing) return existing;
    const promise = task().finally(() => this.running.delete(key));
    this.running.set(key, promise);
    return promise;
  }

  private async doRefresh(
    scope: AuctionScope,
    connectedRealmId: number | null,
    force: boolean,
  ): Promise<RefreshResult> {
    const region = toPrismaRegion(this.blizzard.region);
    if (connectedRealmId !== null) {
      const realm = await this.prisma.connectedRealm.findUnique({
        where: { id: connectedRealmId },
      });
      if (!realm) {
        throw new NotFoundException(
          `Connected realm ${connectedRealmId} is unknown. Sync connected realms first.`,
        );
      }
    }
    const tracked = await this.items.getTrackedItemIds();
    if (tracked.size === 0) {
      return {
        status: 'no-tracked-items',
        snapshot: null,
        trackedItems: 0,
        pricedItems: 0,
      };
    }

    const previous = await this.prisma.auctionSnapshot.findFirst({
      where: { region, scope, connectedRealmId, isSample: false },
      orderBy: { fetchedAt: 'desc' },
    });
    const ifModifiedSince = force
      ? null
      : (previous?.sourceLastModified ?? null);

    let listings: Listing[];
    let lastModified: Date | null;
    if (scope === AuctionScope.COMMODITY) {
      const result = await this.blizzard.getCommodityAuctions(ifModifiedSince);
      if (result.data === null) {
        return this.notModified(previous, tracked.size);
      }
      lastModified = result.lastModified;
      listings = result.data.auctions.map((auction) => ({
        itemId: auction.item.id,
        quantity: auction.quantity,
        unitPrice: auction.unit_price,
      }));
    } else {
      const result = await this.blizzard.getRealmAuctions(
        connectedRealmId!,
        ifModifiedSince,
      );
      if (result.data === null) {
        return this.notModified(previous, tracked.size);
      }
      lastModified = result.lastModified;
      listings = (result.data.auctions ?? []).flatMap((auction) => {
        const unitPrice =
          auction.unit_price ??
          (auction.buyout !== undefined
            ? Math.round(auction.buyout / Math.max(1, auction.quantity))
            : undefined);
        // Bid-only auctions have no instant-buy price and are ignored.
        return unitPrice === undefined
          ? []
          : [
              {
                itemId: auction.item.id,
                quantity: auction.quantity,
                unitPrice,
              },
            ];
      });
    }

    const aggregates = aggregateListings(listings, (itemId) =>
      tracked.has(itemId),
    );
    const snapshot = await this.persistSnapshot({
      region,
      scope,
      connectedRealmId,
      isSample: false,
      sourceLastModified: lastModified,
      auctionCount: listings.length,
      aggregates,
    });
    this.logger.log(
      `Stored ${scope} snapshot #${snapshot.id}: ${listings.length} auctions, ${aggregates.size}/${tracked.size} tracked items priced`,
    );
    return {
      status: 'updated',
      snapshot: toSnapshotDto(snapshot),
      trackedItems: tracked.size,
      pricedItems: aggregates.size,
    };
  }

  async persistSnapshot(input: {
    region: AuctionSnapshot['region'];
    scope: AuctionScope;
    connectedRealmId: number | null;
    isSample: boolean;
    sourceLastModified: Date | null;
    auctionCount: number;
    aggregates: Map<number, ItemPriceAggregate>;
    fetchedAt?: Date;
  }): Promise<AuctionSnapshot> {
    const snapshot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.auctionSnapshot.create({
        data: {
          region: input.region,
          scope: input.scope,
          connectedRealmId: input.connectedRealmId,
          isSample: input.isSample,
          sourceLastModified: input.sourceLastModified,
          auctionCount: input.auctionCount,
          itemCount: input.aggregates.size,
          fetchedAt: input.fetchedAt,
        },
      });
      await tx.itemPriceSnapshot.createMany({
        data: [...input.aggregates.values()].map((aggregate) => ({
          snapshotId: created.id,
          itemId: aggregate.itemId,
          minUnitPrice: BigInt(aggregate.minUnitPrice),
          marketUnitPrice: BigInt(aggregate.marketUnitPrice),
          medianUnitPrice: BigInt(aggregate.medianUnitPrice),
          totalQuantity: aggregate.totalQuantity,
          listingCount: aggregate.listingCount,
          priceTiers: aggregate.priceTiers as unknown as Prisma.InputJsonValue,
        })),
      });
      return created;
    });
    this.cache.invalidatePrefix('crafting:');
    this.cache.invalidatePrefix('pricing:');
    return snapshot;
  }

  private notModified(
    previous: AuctionSnapshot | null,
    trackedItems: number,
  ): RefreshResult {
    return {
      status: 'not-modified',
      snapshot: previous ? toSnapshotDto(previous) : null,
      trackedItems,
      pricedItems: previous?.itemCount ?? 0,
    };
  }
}
