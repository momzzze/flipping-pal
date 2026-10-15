import { Inject, Injectable } from '@nestjs/common';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { toSnapshotDto } from '../auctions/auctions.service';
import { SampleService } from '../sample/sample.service';
import { toPrismaRegion } from '../common/region';

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
    private readonly pricing: PricingService,
    private readonly sample: SampleService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getStatus() {
    const [snapshot, total, complete, sampleLoaded, lastLive] =
      await Promise.all([
        this.pricing.resolveCommoditySnapshot(),
        this.prisma.recipe.count(),
        this.prisma.recipe.count({ where: { isComplete: true } }),
        this.sample.isLoaded(),
        this.prisma.auctionSnapshot.findFirst({
          where: {
            region: toPrismaRegion(this.blizzard.region),
            isSample: false,
          },
          orderBy: { fetchedAt: 'desc' },
        }),
      ]);
    return {
      region: this.blizzard.region.toUpperCase(),
      targetExpansionName: this.blizzard.targetExpansionName,
      blizzardConfigured: this.blizzard.isConfigured,
      dataMode: snapshot ? (snapshot.isSample ? 'SAMPLE' : 'LIVE') : 'NONE',
      commoditySnapshot: snapshot ? toSnapshotDto(snapshot) : null,
      lastLiveSnapshot: lastLive ? toSnapshotDto(lastLive) : null,
      sampleDataLoaded: sampleLoaded,
      recipes: { total, complete, incomplete: total - complete },
      ahCutRate: this.config.ahCutRate,
      autoRefreshMinutes: this.config.auctionRefreshIntervalMinutes,
    };
  }
}
