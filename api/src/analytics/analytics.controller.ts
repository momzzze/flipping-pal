import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parsePositiveInt } from '../common/query';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Historical commodity price & supply for an item (from stored snapshots). */
  @Get('items/:itemId/history')
  itemHistory(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('days') days?: string,
  ) {
    return this.analytics.itemHistory(itemId, parsePositiveInt(days, 7));
  }

  /** Historical profit of a recipe, recomputed for every stored snapshot. */
  @Get('recipes/:recipeId/history')
  recipeHistory(
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Query('days') days?: string,
  ) {
    return this.analytics.recipeProfitHistory(
      recipeId,
      parsePositiveInt(days, 7),
    );
  }
}
