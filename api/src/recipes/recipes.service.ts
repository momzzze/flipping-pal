import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Prisma } from '@prisma/client';
import { BlizzardApiService } from '../blizzard/blizzard-api.service';
import { RecipeResponse } from '../blizzard/blizzard.types';
import { CacheService } from '../common/cache.service';
import { ItemsService } from '../items/items.service';
import { PrismaService } from '../prisma/prisma.service';
import { pickTargetSkillTier } from '../professions/expansion-utils';
import { ProfessionsService } from '../professions/professions.service';
import {
  RECIPE_INCLUDE,
  RecipeDto,
  isRecipeComplete,
  toRecipeDto,
} from './recipe.mapper';
import {
  CreateRecipeDto,
  ListRecipesQueryDto,
  RecipeReagentInputDto,
  UpdateRecipeDto,
} from './recipes.dto';

export const ALCHEMY_PROFESSION_ID = 171;

export interface RecipeImportSummary {
  professionId: number;
  professionName: string;
  skillTierId: number;
  skillTierName: string;
  total: number;
  imported: number;
  complete: number;
  incomplete: number;
  skippedManual: number;
  failed: Array<{ recipeId: number; error: string }>;
}

@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blizzard: BlizzardApiService,
    private readonly items: ItemsService,
    private readonly professions: ProfessionsService,
    private readonly cache: CacheService,
  ) {}

  async list(query: ListRecipesQueryDto): Promise<RecipeDto[]> {
    const where: Prisma.RecipeWhereInput = {
      professionId: query.professionId,
      skillTierId: query.skillTierId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.incomplete === 'true' ? { isComplete: false } : {}),
    };
    const recipes = await this.prisma.recipe.findMany({
      where,
      include: RECIPE_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return recipes.map(toRecipeDto);
  }

  async get(id: number): Promise<RecipeDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return toRecipeDto(recipe);
  }

  /** Manually corrects incomplete/incorrect recipe data. Marks the recipe as manually edited. */
  async update(id: number, dto: UpdateRecipeDto): Promise<RecipeDto> {
    const existing = await this.prisma.recipe.findUnique({
      where: { id },
      include: { reagents: true },
    });
    if (!existing) throw new NotFoundException(`Recipe ${id} not found`);

    const min = dto.outputQuantityMin ?? existing.outputQuantityMin;
    const max =
      dto.outputQuantityMax ?? Math.max(existing.outputQuantityMax, min);
    if (max < min) {
      throw new BadRequestException(
        'outputQuantityMax must be >= outputQuantityMin',
      );
    }
    if (dto.outputItemId) await this.items.ensureItem(dto.outputItemId);
    if (dto.reagents) {
      this.assertUniqueReagents(dto.reagents);
      for (const reagent of dto.reagents)
        await this.items.ensureItem(reagent.itemId);
    }

    const outputItemId =
      dto.outputItemId !== undefined ? dto.outputItemId : existing.outputItemId;
    const reagents = dto.reagents ?? existing.reagents;

    await this.prisma.$transaction(async (tx) => {
      if (dto.reagents) {
        await tx.recipeReagent.deleteMany({ where: { recipeId: id } });
        await tx.recipeReagent.createMany({
          data: dto.reagents.map((reagent) => ({
            recipeId: id,
            itemId: reagent.itemId,
            quantity: reagent.quantity,
            isOptional: reagent.isOptional ?? false,
            affectedByResourcefulness:
              reagent.affectedByResourcefulness ?? true,
          })),
        });
      }
      await tx.recipe.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          outputItemId,
          outputQuantityMin: min,
          outputQuantityMax: max,
          multicraftEligible: dto.multicraftEligible,
          resourcefulnessEligible: dto.resourcefulnessEligible,
          concentrationEligible: dto.concentrationEligible,
          notes: dto.notes,
          manuallyEdited: true,
          isComplete: isRecipeComplete(outputItemId, reagents),
        },
      });
    });
    this.cache.invalidatePrefix('crafting:');
    return this.get(id);
  }

  async create(dto: CreateRecipeDto): Promise<RecipeDto> {
    if (!dto.name) throw new BadRequestException('name is required');
    const profession = await this.prisma.profession.findUnique({
      where: { id: dto.professionId },
    });
    if (!profession)
      throw new BadRequestException(`Profession ${dto.professionId} not found`);
    const recipe = await this.prisma.recipe.create({
      data: {
        name: dto.name,
        professionId: dto.professionId,
        skillTierId: dto.skillTierId,
        source: DataSource.MANUAL,
        manuallyEdited: true,
      },
    });
    return this.update(recipe.id, dto);
  }

  /** Allows a future Blizzard import to overwrite a manually edited recipe again. */
  async resetManualFlag(id: number): Promise<RecipeDto> {
    await this.prisma.recipe.update({
      where: { id },
      data: { manuallyEdited: false },
    });
    return this.get(id);
  }

  async remove(id: number): Promise<void> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    if (recipe.source === DataSource.BLIZZARD) {
      throw new BadRequestException(
        'Imported Blizzard recipes cannot be deleted; edit them instead.',
      );
    }
    await this.prisma.recipe.delete({ where: { id } });
    this.cache.invalidatePrefix('crafting:');
  }

  /**
   * Imports a profession skill tier (default: Alchemy for TARGET_EXPANSION_NAME) from Blizzard:
   * recipes, reagents, output items, crafted quantities. Manually edited recipes are preserved.
   */
  async importFromBlizzard(
    professionId = ALCHEMY_PROFESSION_ID,
    skillTierId?: number,
  ): Promise<RecipeImportSummary> {
    const { profession, skillTiers } =
      await this.professions.importProfession(professionId);
    const tier = skillTierId
      ? skillTiers.find((candidate) => candidate.id === skillTierId)
      : pickTargetSkillTier(skillTiers, this.blizzard.targetExpansionName);
    if (!tier) {
      throw new NotFoundException(
        `No skill tier ${skillTierId ?? ''} found for profession ${profession.name}`,
      );
    }

    const tierDetail = await this.blizzard.getSkillTier(professionId, tier.id);
    await this.prisma.skillTier.update({
      where: { id: tier.id },
      data: {
        minSkill: tierDetail.minimum_skill_level ?? null,
        maxSkill: tierDetail.maximum_skill_level ?? null,
      },
    });

    const refs = (tierDetail.categories ?? []).flatMap((category) =>
      (category.recipes ?? []).map((recipe) => ({
        id: recipe.id,
        category: category.name,
      })),
    );

    const summary: RecipeImportSummary = {
      professionId,
      professionName: profession.name,
      skillTierId: tier.id,
      skillTierName: tier.name,
      total: refs.length,
      imported: 0,
      complete: 0,
      incomplete: 0,
      skippedManual: 0,
      failed: [],
    };

    await Promise.all(
      refs.map(async (ref) => {
        try {
          const result = await this.importRecipe(
            ref.id,
            ref.category,
            professionId,
            tier.id,
          );
          if (result === 'manual') summary.skippedManual += 1;
          else {
            summary.imported += 1;
            if (result === 'complete') summary.complete += 1;
            else summary.incomplete += 1;
          }
        } catch (error) {
          this.logger.warn(
            `Recipe ${ref.id} import failed: ${(error as Error).message}`,
          );
          summary.failed.push({
            recipeId: ref.id,
            error: (error as Error).message,
          });
        }
      }),
    );
    this.cache.invalidatePrefix('crafting:');
    this.logger.log(
      `Imported ${summary.imported}/${summary.total} recipes for ${tier.name} (${summary.incomplete} incomplete)`,
    );
    return summary;
  }

  private async importRecipe(
    blizzardRecipeId: number,
    category: string,
    professionId: number,
    skillTierId: number,
  ): Promise<'complete' | 'incomplete' | 'manual'> {
    const existing = await this.prisma.recipe.findUnique({
      where: { blizzardRecipeId },
    });
    if (existing?.manuallyEdited) return 'manual';

    const remote: RecipeResponse =
      await this.blizzard.getRecipe(blizzardRecipeId);
    const crafted =
      remote.crafted_item ??
      remote.alliance_crafted_item ??
      remote.horde_crafted_item ??
      null;
    const reagentRefs = (remote.reagents ?? []).filter(
      (reagent) => reagent.quantity > 0,
    );

    if (crafted) await this.items.ensureItem(crafted.id, crafted.name);
    for (const reagent of reagentRefs) {
      await this.items.ensureItem(reagent.reagent.id, reagent.reagent.name);
    }

    const quantity = remote.crafted_quantity;
    const outputQuantityMin = Math.max(
      1,
      quantity?.minimum ?? quantity?.value ?? 1,
    );
    const outputQuantityMax = Math.max(
      outputQuantityMin,
      quantity?.maximum ?? quantity?.value ?? 1,
    );
    const complete = isRecipeComplete(
      crafted?.id ?? null,
      reagentRefs.map(() => ({ isOptional: false })),
    );
    const qualitySlots = remote.modified_crafting_slots?.length ?? 0;

    const data = {
      name: remote.name,
      professionId,
      skillTierId,
      category,
      outputItemId: crafted?.id ?? null,
      outputQuantityMin,
      outputQuantityMax,
      isComplete: complete,
      source: DataSource.BLIZZARD,
      notes:
        qualitySlots > 0
          ? `Blizzard lists ${qualitySlots} modified crafting slot(s) (quality/optional reagents) without item ids; verify reagents manually.`
          : null,
    };

    await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.upsert({
        where: { blizzardRecipeId },
        create: { blizzardRecipeId, ...data },
        update: data,
      });
      await tx.recipeReagent.deleteMany({ where: { recipeId: recipe.id } });
      if (reagentRefs.length > 0) {
        await tx.recipeReagent.createMany({
          data: reagentRefs.map((reagent) => ({
            recipeId: recipe.id,
            itemId: reagent.reagent.id,
            quantity: reagent.quantity,
          })),
          skipDuplicates: true,
        });
      }
    });
    return complete ? 'complete' : 'incomplete';
  }

  private assertUniqueReagents(reagents: RecipeReagentInputDto[]): void {
    const seen = new Set<number>();
    for (const reagent of reagents) {
      if (seen.has(reagent.itemId)) {
        throw new BadRequestException(
          `Reagent item ${reagent.itemId} is listed more than once`,
        );
      }
      seen.add(reagent.itemId);
    }
  }
}
