import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AddWatchlistDto } from './watchlist.dto';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list() {
    return this.watchlist.list();
  }

  @Post()
  add(@Body() dto: AddWatchlistDto) {
    return this.watchlist.add(dto);
  }

  @Delete(':recipeId')
  @HttpCode(204)
  remove(@Param('recipeId', ParseIntPipe) recipeId: number) {
    return this.watchlist.remove(recipeId);
  }
}
