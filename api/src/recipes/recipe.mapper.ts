import { DataSource, Prisma } from '@prisma/client';
import { ItemDto, toItemDto } from '../items/items.service';

export const RECIPE_INCLUDE = {
  profession: true,
  skillTier: { include: { expansion: true } },
  outputItem: true,
  reagents: { include: { item: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.RecipeInclude;

export type RecipeWithRelations = Prisma.RecipeGetPayload<{
  include: typeof RECIPE_INCLUDE;
}>;

export interface RecipeReagentDto {
  itemId: number;
  item: ItemDto;
  quantity: number;
  isOptional: boolean;
  affectedByResourcefulness: boolean;
}

export interface RecipeDto {
  id: number;
  blizzardRecipeId: number | null;
  externalId: string | null;
  catalogVersion: string | null;
  name: string;
  professionId: number;
  professionName: string;
  skillTierId: number | null;
  skillTierName: string | null;
  expansionId: number | null;
  expansionName: string | null;
  category: string | null;
  outputItem: ItemDto | null;
  outputQuantityMin: number;
  outputQuantityMax: number;
  multicraftEligible: boolean;
  resourcefulnessEligible: boolean;
  concentrationEligible: boolean;
  isComplete: boolean;
  manuallyEdited: boolean;
  source: DataSource;
  notes: string | null;
  reagents: RecipeReagentDto[];
}

export function toRecipeDto(recipe: RecipeWithRelations): RecipeDto {
  return {
    id: recipe.id,
    blizzardRecipeId: recipe.blizzardRecipeId,
    externalId: recipe.externalId,
    catalogVersion: recipe.catalogVersion,
    name: recipe.name,
    professionId: recipe.professionId,
    professionName: recipe.profession.name,
    skillTierId: recipe.skillTierId,
    skillTierName: recipe.skillTier?.name ?? null,
    expansionId: recipe.skillTier?.expansionId ?? null,
    expansionName: recipe.skillTier?.expansion?.name ?? null,
    category: recipe.category,
    outputItem: recipe.outputItem ? toItemDto(recipe.outputItem) : null,
    outputQuantityMin: recipe.outputQuantityMin,
    outputQuantityMax: recipe.outputQuantityMax,
    multicraftEligible: recipe.multicraftEligible,
    resourcefulnessEligible: recipe.resourcefulnessEligible,
    concentrationEligible: recipe.concentrationEligible,
    isComplete: recipe.isComplete,
    manuallyEdited: recipe.manuallyEdited,
    source: recipe.source,
    notes: recipe.notes,
    reagents: recipe.reagents.map((reagent) => ({
      itemId: reagent.itemId,
      item: toItemDto(reagent.item),
      quantity: reagent.quantity,
      isOptional: reagent.isOptional,
      affectedByResourcefulness: reagent.affectedByResourcefulness,
    })),
  };
}

/** A recipe can be priced when it has an output item and at least one required reagent. */
export function isRecipeComplete(
  outputItemId: number | null | undefined,
  reagents: ReadonlyArray<{ isOptional?: boolean }>,
): boolean {
  return (
    outputItemId !== null &&
    outputItemId !== undefined &&
    reagents.some((reagent) => !reagent.isOptional)
  );
}
