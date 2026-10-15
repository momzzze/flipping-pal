import { parsePositiveInt } from '../common/query';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ItemDto, ItemsService, toItemDto } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  search(
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ): Promise<ItemDto[]> {
    return this.items.search(q, parsePositiveInt(limit, 25));
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<ItemDto> {
    return this.items.getById(id);
  }

  /** Imports (or refreshes) an item from the Blizzard API. Useful when manually fixing recipes. */
  @Post(':id/sync')
  async sync(@Param('id', ParseIntPipe) id: number): Promise<ItemDto> {
    return toItemDto(await this.items.ensureItem(id, undefined, true));
  }
}
