import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { AuctionsService } from './auctions.service';

/**
 * Lightweight in-process scheduler for periodic commodity refreshes.
 * Can be replaced by a Redis/BullMQ repeatable job when running multiple API instances.
 */
@Injectable()
export class AuctionsScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AuctionsScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly auctions: AuctionsService,
    private readonly blizzard: BlizzardApiService,
  ) {}

  onApplicationBootstrap(): void {
    const minutes = this.config.auctionRefreshIntervalMinutes;
    if (minutes <= 0) return;
    if (!this.blizzard.isConfigured) {
      this.logger.warn(
        'Auto-refresh disabled: Blizzard credentials are not configured.',
      );
      return;
    }
    this.logger.log(
      `Auto-refreshing commodity auctions every ${minutes} minute(s)`,
    );
    this.timer = setInterval(() => {
      this.auctions
        .refreshCommodities()
        .catch((error: Error) =>
          this.logger.error(`Scheduled refresh failed: ${error.message}`),
        );
    }, minutes * 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
