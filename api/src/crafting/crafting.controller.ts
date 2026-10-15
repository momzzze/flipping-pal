import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  BreakdownQueryDto,
  ProfitQueryDto,
  UpdateModifiersDto,
} from './crafting.dto';
import { CraftingService } from './crafting.service';

@Controller('crafting')
export class CraftingController {
  constructor(private readonly crafting: CraftingService) {}

  /** Profitability table for the dashboard. */
  @Get('profits')
  profits(@Query() query: ProfitQueryDto) {
    return this.crafting.getProfitTable(query);
  }

  /** Detailed material/cost breakdown for one recipe. */
  @Get('recipes/:recipeId')
  breakdown(
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Query() query: BreakdownQueryDto,
  ) {
    return this.crafting.getBreakdown(recipeId, query);
  }

  @Get('modifiers/:professionId')
  getModifiers(@Param('professionId', ParseIntPipe) professionId: number) {
    return this.crafting.getModifiers(professionId);
  }

  @Put('modifiers/:professionId')
  updateModifiers(
    @Param('professionId', ParseIntPipe) professionId: number,
    @Body() dto: UpdateModifiersDto,
  ) {
    return this.crafting.updateModifiers(professionId, dto);
  }
}
