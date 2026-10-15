import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuctionsService } from '../auctions/auctions.service';
import { ImportRecipesDto } from '../recipes/recipes.dto';
import { RecipesService } from '../recipes/recipes.service';
import { StatusService } from './status.service';

@Controller()
export class StatusController {
  constructor(
    private readonly status: StatusService,
    private readonly recipes: RecipesService,
    private readonly auctions: AuctionsService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('status')
  getStatus() {
    return this.status.getStatus();
  }

  /**
   * End-to-end live workflow: authenticate with Battle.net, import the profession's recipes
   * (default: Alchemy for TARGET_EXPANSION_NAME) and pull current EU commodity prices.
   */
  @Post('sync')
  async sync(@Body() dto: ImportRecipesDto) {
    const recipes = await this.recipes.importFromBlizzard(
      dto.professionId,
      dto.skillTierId,
    );
    const auctions = await this.auctions.refreshCommodities(true);
    return { recipes, auctions };
  }
}
