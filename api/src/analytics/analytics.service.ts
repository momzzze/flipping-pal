import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuctionScope } from '@prisma/client';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { toPrismaRegion } from '../common/region';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { calculateRecipeProfit, PriceTier } from '../crafting/profit-engine';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PriceHistoryPoint {
  snapshotId: number;
  fetchedAt: string;
  minUnitPrice: number;
  marketUnitPrice: number;
  medianUnitPrice: number;
  /** Units listed at snapshot time (supply). */
  totalQuantity: number;
  listingCount: number;
}

export interface ProfitHistoryPoint {
  snapshotId: number;
  fetchedAt: string;
  materialCost: number | null;
  sellUnitPrice: number | null;
  netProfit: number | null;
  roiPercent: number | null;
}

const MAX_DAYS = 90;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly blizzard: BlizzardApiService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Commodity snapshots within the window, restricted to the current data mode (never mixes live/sample). */
  private async commoditySnapshots(days: number) {
    const mode = await this.pricing.getDataMode();
    const since = new Date(
      Date.now() - Math.min(days, MAX_DAYS) * 24 * 60 * 60 * 1000,
    );
    const snapshots = await this.prisma.auctionSnapshot.findMany({
      where: {
        region: toPrismaRegion(this.blizzard.region),
        scope: AuctionScope.COMMODITY,
        isSample: mode === 'SAMPLE',
        fetchedAt: { gte: since },
      },
      orderBy: { fetchedAt: 'asc' },
    });
    return { mode, snapshots };
  }

  async itemHistory(itemId: number, days: number) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    const { mode, snapshots } = await this.commoditySnapshots(days);
    const rows = await this.prisma.itemPriceSnapshot.findMany({
      where: { itemId, snapshotId: { in: snapshots.map((s) => s.id) } },
    });
    const bySnapshot = new Map(rows.map((row) => [row.snapshotId, row]));
    const points: PriceHistoryPoint[] = snapshots.flatMap((snapshot) => {
      const row = bySnapshot.get(snapshot.id);
      return row
        ? [
            {
              snapshotId: snapshot.id,
              fetchedAt: snapshot.fetchedAt.toISOString(),
              minUnitPrice: Number(row.minUnitPrice),
              marketUnitPrice: Number(row.marketUnitPrice),
              medianUnitPrice: Number(row.medianUnitPrice),
              totalQuantity: row.totalQuantity,
              listingCount: row.listingCount,
            },
          ]
        : [];
    });
    return { itemId, itemName: item.name, dataMode: mode, points };
  }

  async recipeProfitHistory(recipeId: number, days: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { reagents: true },
    });
    if (!recipe) throw new NotFoundException(`Recipe ${recipeId} not found`);
    const { mode, snapshots } = await this.commoditySnapshots(days);
    const required = recipe.reagents.filter((reagent) => !reagent.isOptional);
    const itemIds = [
      ...required.map((reagent) => reagent.itemId),
      ...(recipe.outputItemId !== null ? [recipe.outputItemId] : []),
    ];
    const rows = await this.prisma.itemPriceSnapshot.findMany({
      where: {
        itemId: { in: itemIds },
        snapshotId: { in: snapshots.map((s) => s.id) },
      },
    });
    const prices = new Map<string, (typeof rows)[number]>();
    for (const row of rows) prices.set(`${row.snapshotId}:${row.itemId}`, row);

    const points: ProfitHistoryPoint[] = snapshots.map((snapshot) => {
      const output =
        recipe.outputItemId !== null
          ? prices.get(`${snapshot.id}:${recipe.outputItemId}`)
          : undefined;
      const result = calculateRecipeProfit({
        reagents: required.map((reagent) => ({
          itemId: reagent.itemId,
          quantityPerCraft: reagent.quantity,
          tiers: prices.get(`${snapshot.id}:${reagent.itemId}`)?.priceTiers as
            PriceTier[] | undefined,
        })),
        output: output
          ? {
              minUnitPrice: Number(output.minUnitPrice),
              marketUnitPrice: Number(output.marketUnitPrice),
            }
          : null,
        outputQuantityPerCraft:
          (recipe.outputQuantityMin + recipe.outputQuantityMax) / 2,
        crafts: 1,
        ahCutRate: this.config.ahCutRate,
      });
      return {
        snapshotId: snapshot.id,
        fetchedAt: snapshot.fetchedAt.toISOString(),
        materialCost: result.materialCost,
        sellUnitPrice: result.sellUnitPrice,
        netProfit: result.netProfit,
        roiPercent: result.roi !== null ? result.roi * 100 : null,
      };
    });
    return { recipeId, recipeName: recipe.name, dataMode: mode, points };
  }
}
