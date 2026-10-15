import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { ItemDto, toItemDto } from '../items/items.service';
import { PriceContext, PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RECIPE_INCLUDE,
  RecipeWithRelations,
  toRecipeDto,
} from '../recipes/recipe.mapper';
import {
  BreakdownQueryDto,
  ProfitQueryDto,
  UpdateModifiersDto,
} from './crafting.dto';
import {
  calculateRecipeProfit,
  CraftingModifiers,
  NO_MODIFIERS,
  ProfitResult,
  SellPriceStrategy,
} from './profit-engine';

const RESULT_CACHE_TTL_MS = 60_000;

export interface ProfitRow {
  recipeId: number;
  recipeName: string;
  professionId: number;
  professionName: string;
  skillTierName: string | null;
  expansionId: number | null;
  expansionName: string | null;
  category: string | null;
  source: string;
  isComplete: boolean;
  manuallyEdited: boolean;
  watchlisted: boolean;
  outputItem: ItemDto | null;
  outputQuantityPerCraft: number;
  crafts: number;
  materialCost: number | null;
  sellUnitPrice: number | null;
  grossRevenue: number | null;
  ahFee: number | null;
  netProfit: number | null;
  netProfitPerCraft: number | null;
  /** Percent (25 = 25%). */
  roiPercent: number | null;
  /** Units of the crafted item currently listed — SUPPLY, not sales. */
  outputSupply: number | null;
  outputListings: number | null;
  /** How many crafts the currently listed reagent supply could cover. */
  maxCraftsFromSupply: number | null;
  missingReagentPrices: number;
  missingOutputPrice: boolean;
  insufficientReagentSupply: boolean;
}

export interface ProfitTableResponse {
  dataMode: PriceContext['dataMode'];
  commoditySnapshot: PriceContext['commoditySnapshot'];
  realmSnapshot: PriceContext['realmSnapshot'];
  ahCutRate: number;
  crafts: number;
  sellPriceStrategy: SellPriceStrategy;
  generatedAt: string;
  rows: ProfitRow[];
}

@Injectable()
export class CraftingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly cache: CacheService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  getProfitTable(query: ProfitQueryDto): Promise<ProfitTableResponse> {
    const key = `crafting:table:${JSON.stringify(query)}`;
    return this.cache.wrap(key, RESULT_CACHE_TTL_MS, () =>
      this.buildProfitTable(query),
    );
  }

  private async buildProfitTable(
    query: ProfitQueryDto,
  ): Promise<ProfitTableResponse> {
    const crafts = query.crafts ?? 1;
    const strategy = query.sellPriceStrategy ?? 'MIN';
    const where: Prisma.RecipeWhereInput = {
      professionId: query.professionId,
      skillTierId: query.skillTierId,
      ...(query.expansionId !== undefined
        ? { skillTier: { expansionId: query.expansionId } }
        : {}),
      ...(query.includeIncomplete ? {} : { isComplete: true }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.quality?.length
        ? { outputItem: { quality: { in: query.quality } } }
        : {}),
      ...(query.watchlistOnly ? { watchlistEntries: { some: {} } } : {}),
    };
    const recipes = await this.prisma.recipe.findMany({
      where,
      include: {
        ...RECIPE_INCLUDE,
        watchlistEntries: { select: { id: true } },
      },
    });

    const itemIds = recipes.flatMap((recipe) => [
      ...(recipe.outputItemId !== null ? [recipe.outputItemId] : []),
      ...recipe.reagents.map((reagent) => reagent.itemId),
    ]);
    const context = await this.pricing.getPriceContext(itemIds, query.realmId);
    const modifiers = await this.loadModifiers(
      recipes.map((recipe) => recipe.professionId),
    );

    const rows = recipes
      .map((recipe) =>
        this.toRow(
          recipe,
          recipe.watchlistEntries.length > 0,
          this.compute(
            recipe,
            context,
            crafts,
            strategy,
            modifiers.get(recipe.professionId),
          ),
          context,
          crafts,
        ),
      )
      .filter((row) => this.matchesFilters(row, query))
      .sort((a, b) => (b.netProfit ?? -Infinity) - (a.netProfit ?? -Infinity));

    return {
      dataMode: context.dataMode,
      commoditySnapshot: context.commoditySnapshot,
      realmSnapshot: context.realmSnapshot,
      ahCutRate: this.config.ahCutRate,
      crafts,
      sellPriceStrategy: strategy,
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  async getBreakdown(recipeId: number, query: BreakdownQueryDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ...RECIPE_INCLUDE,
        watchlistEntries: { select: { id: true } },
      },
    });
    if (!recipe) throw new NotFoundException(`Recipe ${recipeId} not found`);
    const crafts = query.crafts ?? 1;
    const strategy = query.sellPriceStrategy ?? 'MIN';
    const itemIds = [
      ...(recipe.outputItemId !== null ? [recipe.outputItemId] : []),
      ...recipe.reagents.map((reagent) => reagent.itemId),
    ];
    const context = await this.pricing.getPriceContext(itemIds, query.realmId);
    const modifiers = (await this.loadModifiers([recipe.professionId])).get(
      recipe.professionId,
    );
    const result = this.compute(recipe, context, crafts, strategy, modifiers);
    const outputPrice =
      recipe.outputItemId !== null
        ? context.prices.get(recipe.outputItemId)
        : undefined;

    return {
      dataMode: context.dataMode,
      commoditySnapshot: context.commoditySnapshot,
      realmSnapshot: context.realmSnapshot,
      ahCutRate: this.config.ahCutRate,
      sellPriceStrategy: strategy,
      modifiers: modifiers ?? NO_MODIFIERS,
      recipe: toRecipeDto(recipe),
      watchlisted: recipe.watchlistEntries.length > 0,
      result,
      output: recipe.outputItem
        ? {
            item: toItemDto(recipe.outputItem),
            price: outputPrice
              ? {
                  ...outputPrice,
                  priceTiers: outputPrice.priceTiers.slice(0, 15),
                }
              : null,
          }
        : null,
      reagents: recipe.reagents.map((reagent) => {
        const price = context.prices.get(reagent.itemId);
        const breakdown = result.reagents.find(
          (entry) => entry.itemId === reagent.itemId,
        );
        return {
          item: toItemDto(reagent.item),
          quantityPerCraft: reagent.quantity,
          isOptional: reagent.isOptional,
          requiredQuantity: breakdown?.requiredQuantity ?? 0,
          totalCost: breakdown?.purchase?.totalCost ?? null,
          averageUnitPrice: breakdown?.purchase?.averageUnitPrice ?? null,
          marginalUnitPrice: breakdown?.purchase?.marginalUnitPrice ?? null,
          isFullyFilled: breakdown?.purchase?.isFullyFilled ?? null,
          minUnitPrice: price?.minUnitPrice ?? null,
          marketUnitPrice: price?.marketUnitPrice ?? null,
          supply: price?.totalQuantity ?? null,
          listings: price?.listingCount ?? null,
          priceTiers: price?.priceTiers.slice(0, 15) ?? [],
        };
      }),
    };
  }

  async getModifiers(professionId: number): Promise<CraftingModifiers> {
    return (
      (await this.loadModifiers([professionId])).get(professionId) ??
      NO_MODIFIERS
    );
  }

  async updateModifiers(
    professionId: number,
    dto: UpdateModifiersDto,
  ): Promise<CraftingModifiers> {
    const profession = await this.prisma.profession.findUnique({
      where: { id: professionId },
    });
    if (!profession)
      throw new NotFoundException(`Profession ${professionId} not found`);
    await this.prisma.craftingModifierProfile.upsert({
      where: { professionId_name: { professionId, name: 'Default' } },
      create: { professionId, name: 'Default', ...dto },
      update: { ...dto },
    });
    this.cache.invalidatePrefix('crafting:');
    return this.getModifiers(professionId);
  }

  private async loadModifiers(
    professionIds: number[],
  ): Promise<Map<number, CraftingModifiers>> {
    const profiles = await this.prisma.craftingModifierProfile.findMany({
      where: {
        professionId: { in: [...new Set(professionIds)] },
        name: 'Default',
      },
    });
    return new Map(
      profiles.map((profile) => [
        profile.professionId,
        {
          multicraftChance: profile.multicraftChance,
          multicraftYieldBonus: profile.multicraftYieldBonus,
          resourcefulnessChance: profile.resourcefulnessChance,
          resourcefulnessSavings: profile.resourcefulnessSavings,
        },
      ]),
    );
  }

  private compute(
    recipe: RecipeWithRelations,
    context: PriceContext,
    crafts: number,
    strategy: SellPriceStrategy,
    modifiers: CraftingModifiers | undefined,
  ): ProfitResult {
    const outputPrice =
      recipe.outputItemId !== null
        ? context.prices.get(recipe.outputItemId)
        : undefined;
    return calculateRecipeProfit({
      reagents: recipe.reagents
        .filter((reagent) => !reagent.isOptional)
        .map((reagent) => ({
          itemId: reagent.itemId,
          quantityPerCraft: reagent.quantity,
          tiers: context.prices.get(reagent.itemId)?.priceTiers,
          affectedByResourcefulness: reagent.affectedByResourcefulness,
        })),
      output: outputPrice
        ? {
            minUnitPrice: outputPrice.minUnitPrice,
            marketUnitPrice: outputPrice.marketUnitPrice,
          }
        : null,
      outputQuantityPerCraft:
        (recipe.outputQuantityMin + recipe.outputQuantityMax) / 2,
      crafts,
      ahCutRate: this.config.ahCutRate,
      sellPriceStrategy: strategy,
      modifiers,
      multicraftEligible: recipe.multicraftEligible,
      resourcefulnessEligible: recipe.resourcefulnessEligible,
    });
  }

  private toRow(
    recipe: RecipeWithRelations,
    watchlisted: boolean,
    result: ProfitResult,
    context: PriceContext,
    crafts: number,
  ): ProfitRow {
    const outputPrice =
      recipe.outputItemId !== null
        ? context.prices.get(recipe.outputItemId)
        : undefined;
    const required = recipe.reagents.filter((reagent) => !reagent.isOptional);
    const supplyCrafts = required.map((reagent) => {
      const supply = context.prices.get(reagent.itemId)?.totalQuantity;
      return supply === undefined
        ? null
        : Math.floor(supply / reagent.quantity);
    });
    const maxCraftsFromSupply =
      supplyCrafts.length > 0 && supplyCrafts.every((value) => value !== null)
        ? Math.min(...supplyCrafts)
        : null;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      professionId: recipe.professionId,
      professionName: recipe.profession.name,
      skillTierName: recipe.skillTier?.name ?? null,
      expansionId: recipe.skillTier?.expansionId ?? null,
      expansionName: recipe.skillTier?.expansion?.name ?? null,
      category: recipe.category,
      source: recipe.source,
      isComplete: recipe.isComplete,
      manuallyEdited: recipe.manuallyEdited,
      watchlisted,
      outputItem: recipe.outputItem ? toItemDto(recipe.outputItem) : null,
      outputQuantityPerCraft:
        (recipe.outputQuantityMin + recipe.outputQuantityMax) / 2,
      crafts,
      materialCost: result.materialCost,
      sellUnitPrice: result.sellUnitPrice,
      grossRevenue: result.grossRevenue,
      ahFee: result.ahFee,
      netProfit: result.netProfit,
      netProfitPerCraft: result.netProfitPerCraft,
      roiPercent: result.roi !== null ? result.roi * 100 : null,
      outputSupply: outputPrice?.totalQuantity ?? null,
      outputListings: outputPrice?.listingCount ?? null,
      maxCraftsFromSupply,
      missingReagentPrices: result.missingReagentPrices.length,
      missingOutputPrice: result.missingOutputPrice,
      insufficientReagentSupply: result.insufficientReagentSupply,
    };
  }

  private matchesFilters(row: ProfitRow, query: ProfitQueryDto): boolean {
    if (
      query.minProfit !== undefined &&
      (row.netProfitPerCraft ?? -Infinity) < query.minProfit
    ) {
      return false;
    }
    if (
      query.minRoi !== undefined &&
      (row.roiPercent ?? -Infinity) < query.minRoi
    )
      return false;
    if (
      query.minSupply !== undefined &&
      (row.outputSupply ?? 0) < query.minSupply
    )
      return false;
    return true;
  }
}
