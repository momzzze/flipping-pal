import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Item, ItemQuality } from '@prisma/client';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { PrismaService } from '../prisma/prisma.service';

const QUALITY_VALUES = new Set<string>(Object.values(ItemQuality));

export function mapItemQuality(type: string | undefined): ItemQuality {
  if (type && QUALITY_VALUES.has(type)) return type as ItemQuality;
  return ItemQuality.UNKNOWN;
}

export interface ItemDto {
  id: number;
  name: string;
  quality: ItemQuality;
  iconUrl: string | null;
  craftingQuality: number | null;
  isCommodity: boolean;
  source: DataSource;
}

export function toItemDto(item: Item): ItemDto {
  return {
    id: item.id,
    name: item.name,
    quality: item.quality,
    iconUrl: item.iconUrl,
    craftingQuality: item.craftingQuality,
    isCommodity: item.isCommodity,
    source: item.source,
  };
}

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);
  private readonly inFlight = new Map<number, Promise<Item>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
  ) {}

  async search(query: string, limit = 25): Promise<ItemDto[]> {
    const asNumber = Number(query);
    const items = await this.prisma.item.findMany({
      where:
        Number.isInteger(asNumber) && query.trim() !== ''
          ? {
              OR: [
                { id: asNumber },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : { name: { contains: query, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return items.map(toItemDto);
  }

  async getById(id: number): Promise<ItemDto> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return toItemDto(item);
  }

  /**
   * Ensures an item exists locally, importing name/quality/icon from Blizzard when needed.
   * Falls back to a placeholder name when Blizzard data is unavailable so recipes still import.
   */
  ensureItem(id: number, fallbackName?: string, force = false): Promise<Item> {
    const pending = this.inFlight.get(id);
    if (pending) return pending;
    const promise = this.syncItem(id, fallbackName, force).finally(() =>
      this.inFlight.delete(id),
    );
    this.inFlight.set(id, promise);
    return promise;
  }

  private async syncItem(
    id: number,
    fallbackName: string | undefined,
    force: boolean,
  ): Promise<Item> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (existing && existing.lastSyncedAt && !force) return existing;
    if (!this.blizzard.isConfigured) {
      if (existing) return existing;
      return this.prisma.item.upsert({
        where: { id },
        create: {
          id,
          name: fallbackName ?? `Item ${id}`,
          source: DataSource.MANUAL,
        },
        update: {},
      });
    }
    try {
      const [item, media] = await Promise.all([
        this.blizzard.getItem(id),
        this.blizzard.getItemMedia(id).catch(() => null),
      ]);
      const iconUrl =
        media?.assets?.find((asset) => asset.key === 'icon')?.value ?? null;
      const data = {
        name: item.name,
        quality: mapItemQuality(item.quality?.type),
        iconUrl,
        itemClass: item.item_class?.name ?? null,
        itemSubclass: item.item_subclass?.name ?? null,
        vendorBuyPrice:
          item.purchase_price !== undefined
            ? BigInt(item.purchase_price)
            : null,
        vendorSellPrice:
          item.sell_price !== undefined ? BigInt(item.sell_price) : null,
        source: DataSource.BLIZZARD,
        lastSyncedAt: new Date(),
      };
      return this.prisma.item.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    } catch (error) {
      this.logger.warn(
        `Could not import item ${id}: ${(error as Error).message}`,
      );
      if (existing) return existing;
      return this.prisma.item.upsert({
        where: { id },
        create: {
          id,
          name: fallbackName ?? `Item ${id}`,
          source: DataSource.BLIZZARD,
        },
        update: {},
      });
    }
  }

  /** Item ids referenced by any recipe (reagents or outputs). These are the items we snapshot prices for. */
  async getTrackedItemIds(): Promise<Set<number>> {
    const [reagents, outputs] = await Promise.all([
      this.prisma.recipeReagent.findMany({
        select: { itemId: true },
        distinct: ['itemId'],
      }),
      this.prisma.recipe.findMany({
        where: { outputItemId: { not: null } },
        select: { outputItemId: true },
        distinct: ['outputItemId'],
      }),
    ]);
    const ids = new Set<number>();
    for (const reagent of reagents) ids.add(reagent.itemId);
    for (const output of outputs)
      if (output.outputItemId !== null) ids.add(output.outputItemId);
    return ids;
  }
}
