import { Injectable, Logger } from '@nestjs/common';
import { AuctionScope, DataSource } from '@prisma/client';
import { aggregateListings } from '../auctions/auction-aggregation';
import { AuctionsService } from '../auctions/auctions.service';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { CacheService } from '../common/cache.service';
import { toPrismaRegion } from '../common/region';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionsService } from '../professions/professions.service';
import {
  SAMPLE_EXPANSION_NAME,
  SAMPLE_ID_BASE,
  SAMPLE_ITEMS,
  SAMPLE_PROFESSION,
  SAMPLE_RECIPES,
  SAMPLE_SKILL_TIER_ID,
  SAMPLE_SNAPSHOT_HOURS,
  generateSampleListings,
  mulberry32,
} from './sample-data';

@Injectable()
export class SampleService {
  private readonly logger = new Logger(SampleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly professions: ProfessionsService,
    private readonly auctions: AuctionsService,
    private readonly blizzard: BlizzardApiService,
    private readonly cache: CacheService,
  ) {}

  async isLoaded(): Promise<boolean> {
    return (
      (await this.prisma.recipe.count({
        where: { source: DataSource.SAMPLE },
      })) > 0
    );
  }

  /** Loads (or reloads) the explicitly labeled sample Alchemy dataset and sample price history. */
  async load(): Promise<{ items: number; recipes: number; snapshots: number }> {
    await this.clear();

    await this.prisma.profession.upsert({
      where: { id: SAMPLE_PROFESSION.id },
      create: { ...SAMPLE_PROFESSION, source: DataSource.SAMPLE },
      update: {},
    });
    const expansionId = await this.professions.upsertExpansion(
      SAMPLE_EXPANSION_NAME,
      SAMPLE_SKILL_TIER_ID,
    );
    await this.prisma.skillTier.create({
      data: {
        id: SAMPLE_SKILL_TIER_ID,
        name: `${SAMPLE_EXPANSION_NAME} Alchemy (Sample)`,
        professionId: SAMPLE_PROFESSION.id,
        expansionId,
        source: DataSource.SAMPLE,
      },
    });
    await this.prisma.item.createMany({
      data: SAMPLE_ITEMS.map((item) => ({
        id: item.id,
        name: item.name,
        quality: item.quality,
        isCommodity: true,
        source: DataSource.SAMPLE,
      })),
      skipDuplicates: true,
    });

    for (const recipe of SAMPLE_RECIPES) {
      await this.prisma.recipe.create({
        data: {
          name: recipe.name,
          professionId: SAMPLE_PROFESSION.id,
          skillTierId: SAMPLE_SKILL_TIER_ID,
          category: recipe.category,
          outputItemId: recipe.outputItemId,
          outputQuantityMin: recipe.outputQuantity,
          outputQuantityMax: recipe.outputQuantity,
          multicraftEligible: recipe.multicraft,
          resourcefulnessEligible: recipe.reagents.length > 0,
          isComplete:
            recipe.outputItemId !== null && recipe.reagents.length > 0,
          source: DataSource.SAMPLE,
          notes: 'SAMPLE DATA - fictional recipe for demonstration only.',
          reagents: { create: recipe.reagents },
        },
      });
    }

    const random = mulberry32(42);
    const region = toPrismaRegion(this.blizzard.region);
    const now = Date.now();
    for (
      let hoursAgo = SAMPLE_SNAPSHOT_HOURS - 1;
      hoursAgo >= 0;
      hoursAgo -= 1
    ) {
      const listings = SAMPLE_ITEMS.flatMap((item, index) =>
        generateSampleListings(item, index, hoursAgo, random),
      );
      await this.auctions.persistSnapshot({
        region,
        scope: AuctionScope.COMMODITY,
        connectedRealmId: null,
        isSample: true,
        sourceLastModified: null,
        auctionCount: listings.length,
        aggregates: aggregateListings(listings),
        fetchedAt: new Date(now - hoursAgo * 60 * 60 * 1000),
      });
    }
    this.cache.invalidatePrefix('crafting:');
    this.logger.warn(
      'Loaded SAMPLE data. These are fictional prices, not live market data.',
    );
    return {
      items: SAMPLE_ITEMS.length,
      recipes: SAMPLE_RECIPES.length,
      snapshots: SAMPLE_SNAPSHOT_HOURS,
    };
  }

  /** Removes all sample recipes, items, skill tiers and snapshots. */
  async clear(): Promise<void> {
    await this.prisma.auctionSnapshot.deleteMany({ where: { isSample: true } });
    await this.prisma.recipe.deleteMany({
      where: { source: DataSource.SAMPLE },
    });
    await this.prisma.skillTier.deleteMany({
      where: { source: DataSource.SAMPLE },
    });
    try {
      await this.prisma.item.deleteMany({
        where: { source: DataSource.SAMPLE, id: { gte: SAMPLE_ID_BASE } },
      });
    } catch {
      this.logger.warn(
        'Some sample items are still referenced by non-sample recipes and were kept.',
      );
    }
    const profession = await this.prisma.profession.findUnique({
      where: { id: SAMPLE_PROFESSION.id },
    });
    if (profession?.source === DataSource.SAMPLE) {
      const remaining = await this.prisma.recipe.count({
        where: { professionId: profession.id },
      });
      if (remaining === 0)
        await this.prisma.profession.delete({ where: { id: profession.id } });
    }
    this.cache.invalidatePrefix('crafting:');
  }
}
