import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuctionsModule } from './auctions/auctions.module';
import { BlizzardModule } from './blizzard/blizzard.module';
import { CommonModule } from './common/common.module';
import { CraftingModule } from './crafting/crafting.module';
import { ItemsModule } from './items/items.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessionsModule } from './professions/professions.module';
import { RecipesModule } from './recipes/recipes.module';
import { SampleModule } from './sample/sample.module';
import { StatusModule } from './status/status.module';
import { WatchlistModule } from './watchlist/watchlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    CommonModule,
    PrismaModule,
    BlizzardModule,
    ItemsModule,
    ProfessionsModule,
    RecipesModule,
    AuctionsModule,
    PricingModule,
    CraftingModule,
    AnalyticsModule,
    WatchlistModule,
    SampleModule,
    StatusModule,
  ],
})
export class AppModule {}
