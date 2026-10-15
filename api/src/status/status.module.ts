import { Module } from '@nestjs/common';
import { AuctionsModule } from '../auctions/auctions.module';
import { PricingModule } from '../pricing/pricing.module';
import { RecipesModule } from '../recipes/recipes.module';
import { SampleModule } from '../sample/sample.module';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';

@Module({
  imports: [AuctionsModule, PricingModule, RecipesModule, SampleModule],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
