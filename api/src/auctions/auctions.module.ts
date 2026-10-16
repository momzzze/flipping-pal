import { Module } from '@nestjs/common';
import { ItemsModule } from '../items/items.module';
import { AuctionsController } from './auctions.controller';
import { ClassicForeverScanImporter } from './classic-forever-scan-importer';
import { AuctionsScheduler } from './auctions.scheduler';
import { AuctionsService } from './auctions.service';

@Module({
  imports: [ItemsModule],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionsScheduler, ClassicForeverScanImporter],
  exports: [AuctionsService, ClassicForeverScanImporter],
})
export class AuctionsModule {}
