import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateRecipeDto,
  ImportRecipesDto,
  ListRecipesQueryDto,
  UpdateRecipeDto,
} from './recipes.dto';
import { RecipesService } from './recipes.service';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  list(@Query() query: ListRecipesQueryDto) {
    return this.recipes.list(query);
  }

  /** Imports recipes from Blizzard. Defaults to Alchemy (171) and the target expansion skill tier. */
  @Post('import')
  import(@Body() dto: ImportRecipesDto) {
    return this.recipes.importFromBlizzard(dto.professionId, dto.skillTierId);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto) {
    return this.recipes.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.recipes.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRecipeDto) {
    return this.recipes.update(id, dto);
  }

  @Post(':id/reset-manual')
  resetManual(@Param('id', ParseIntPipe) id: number) {
    return this.recipes.resetManualFlag(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.recipes.remove(id);
  }
}
