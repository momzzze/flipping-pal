import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuctionScope,
  AuctionSnapshot,
  ItemPriceSnapshot,
} from '@prisma/client';
import { toSnapshotDto, SnapshotDto } from '../auctions/auctions.service';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { toPrismaRegion } from '../common/region';
import { PriceTier } from '../crafting/profit-engine';
import { PrismaService } from '../prisma/prisma.service';

/** LIVE = real Blizzard data, SAMPLE = explicitly labeled demo data, NONE = no snapshot yet. */
export type DataMode = 'LIVE' | 'SAMPLE' | 'NONE';

export interface ItemPrice {
  itemId: number;
  scope: AuctionScope;
  snapshotId: number;
  isSample: boolean;
  minUnitPrice: number;
  marketUnitPrice: number;
  medianUnitPrice: number;
  /** Units currently listed (supply). Not a measure of demand or sales. */
  totalQuantity: number;
  listingCount: number;
  priceTiers: PriceTier[];
}

export interface PriceContext {
  dataMode: DataMode;
  commoditySnapshot: SnapshotDto | null;
  realmSnapshot: SnapshotDto | null;
  prices: Map<number, ItemPrice>;
}

function parseTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { unitPrice, quantity } = entry as Record<string, unknown>;
    return typeof unitPrice === 'number' && typeof quantity === 'number'
      ? [{ unitPrice, quantity }]
      : [];
  });
}

function toItemPrice(
  row: ItemPriceSnapshot,
  snapshot: AuctionSnapshot,
): ItemPrice {
  return {
    itemId: row.itemId,
    scope: snapshot.scope,
    snapshotId: snapshot.id,
    isSample: snapshot.isSample,
    minUnitPrice: Number(row.minUnitPrice),
    marketUnitPrice: Number(row.marketUnitPrice),
    medianUnitPrice: Number(row.medianUnitPrice),
    totalQuantity: row.totalQuantity,
    listingCount: row.listingCount,
    priceTiers: parseTiers(row.priceTiers),
  };
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
  ) {}

  /**
   * The commodity snapshot used for pricing: the newest LIVE snapshot, or — only when no
   * live data exists — the newest SAMPLE snapshot. Live and sample prices are never mixed.
   */
  async resolveCommoditySnapshot(): Promise<AuctionSnapshot | null> {
    const region = toPrismaRegion(this.blizzard.region);
    const live = await this.prisma.auctionSnapshot.findFirst({
      where: { region, scope: AuctionScope.COMMODITY, isSample: false },
      orderBy: { fetchedAt: 'desc' },
    });
    if (live) return live;
    return this.prisma.auctionSnapshot.findFirst({
      where: { region, scope: AuctionScope.COMMODITY, isSample: true },
      orderBy: { fetchedAt: 'desc' },
    });
  }

  async resolveRealmSnapshot(
    connectedRealmId: number,
  ): Promise<AuctionSnapshot | null> {
    return this.prisma.auctionSnapshot.findFirst({
      where: {
        region: toPrismaRegion(this.blizzard.region),
        scope: AuctionScope.REALM,
        connectedRealmId,
        isSample: false,
      },
      orderBy: { fetchedAt: 'desc' },
    });
  }

  async getDataMode(): Promise<DataMode> {
    const snapshot = await this.resolveCommoditySnapshot();
    if (!snapshot) return 'NONE';
    return snapshot.isSample ? 'SAMPLE' : 'LIVE';
  }

  /**
   * Loads prices for the given items: commodity prices first, then (for live data only)
   * connected-realm prices for items not traded as commodities.
   */
  async getPriceContext(
    itemIds: Iterable<number>,
    connectedRealmId?: number,
  ): Promise<PriceContext> {
    const ids = [...new Set(itemIds)];
    const commodity = await this.resolveCommoditySnapshot();
    const prices = new Map<number, ItemPrice>();
    if (commodity && ids.length > 0) {
      const rows = await this.prisma.itemPriceSnapshot.findMany({
        where: { snapshotId: commodity.id, itemId: { in: ids } },
      });
      for (const row of rows)
        prices.set(row.itemId, toItemPrice(row, commodity));
    }

    let realm: AuctionSnapshot | null = null;
    if (connectedRealmId !== undefined && (!commodity || !commodity.isSample)) {
      realm = await this.resolveRealmSnapshot(connectedRealmId);
      const missing = ids.filter((id) => !prices.has(id));
      if (realm && missing.length > 0) {
        const rows = await this.prisma.itemPriceSnapshot.findMany({
          where: { snapshotId: realm.id, itemId: { in: missing } },
        });
        for (const row of rows) prices.set(row.itemId, toItemPrice(row, realm));
      }
    }

    return {
      dataMode: commodity
        ? commodity.isSample
          ? 'SAMPLE'
          : 'LIVE'
        : realm
          ? 'LIVE'
          : 'NONE',
      commoditySnapshot: commodity ? toSnapshotDto(commodity) : null,
      realmSnapshot: realm ? toSnapshotDto(realm) : null,
      prices,
    };
  }

  async getItemPrice(itemId: number, connectedRealmId?: number) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    const context = await this.getPriceContext([itemId], connectedRealmId);
    return {
      itemId,
      itemName: item.name,
      dataMode: context.dataMode,
      commoditySnapshot: context.commoditySnapshot,
      realmSnapshot: context.realmSnapshot,
      price: context.prices.get(itemId) ?? null,
    };
  }
}
