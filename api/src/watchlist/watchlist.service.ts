import { Injectable, NotFoundException } from '@nestjs/common';
import { WatchlistEntry } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { toNumber } from '../common/serialization';
import { PrismaService } from '../prisma/prisma.service';
import { AddWatchlistDto } from './watchlist.dto';

export interface WatchlistEntryDto {
  id: number;
  recipeId: number;
  recipeName: string;
  note: string | null;
  targetProfit: number | null;
  createdAt: string;
}

@Injectable()
export class WatchlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(): Promise<WatchlistEntryDto[]> {
    const entries = await this.prisma.watchlistEntry.findMany({
      include: { recipe: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map((entry) => this.toDto(entry, entry.recipe.name));
  }

  async add(dto: AddWatchlistDto): Promise<WatchlistEntryDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipeId },
    });
    if (!recipe)
      throw new NotFoundException(`Recipe ${dto.recipeId} not found`);
    const data = {
      note: dto.note ?? null,
      targetProfit:
        dto.targetProfit !== undefined ? BigInt(dto.targetProfit) : null,
    };
    const entry = await this.prisma.watchlistEntry.upsert({
      where: { recipeId: dto.recipeId },
      create: { recipeId: dto.recipeId, ...data },
      update: data,
    });
    this.cache.invalidatePrefix('crafting:');
    return this.toDto(entry, recipe.name);
  }

  async remove(recipeId: number): Promise<void> {
    await this.prisma.watchlistEntry.deleteMany({ where: { recipeId } });
    this.cache.invalidatePrefix('crafting:');
  }

  private toDto(entry: WatchlistEntry, recipeName: string): WatchlistEntryDto {
    return {
      id: entry.id,
      recipeId: entry.recipeId,
      recipeName,
      note: entry.note,
      targetProfit: toNumber(entry.targetProfit),
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
