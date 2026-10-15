import { Module } from '@nestjs/common';
import { ItemsModule } from '../items/items.module';
import { AuctionsController } from './auctions.controller';
import { AuctionsScheduler } from './auctions.scheduler';
import { AuctionsService } from './auctions.service';

@Module({
  imports: [ItemsModule],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionsScheduler],
  exports: [AuctionsService],
})
export class AuctionsModule {}
