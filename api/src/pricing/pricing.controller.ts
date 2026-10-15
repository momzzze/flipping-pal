import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('items/:itemId')
  getItemPrice(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('realmId', new ParseIntPipe({ optional: true })) realmId?: number,
  ) {
    return this.pricing.getItemPrice(itemId, realmId);
  }
}
