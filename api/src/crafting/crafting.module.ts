import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { CraftingController } from './crafting.controller';
import { CraftingService } from './crafting.service';

@Module({
  imports: [PricingModule],
  controllers: [CraftingController],
  providers: [CraftingService],
  exports: [CraftingService],
})
export class CraftingModule {}
