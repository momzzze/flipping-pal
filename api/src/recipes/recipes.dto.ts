import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeReagentInputDto {
  @IsInt()
  @Min(1)
  itemId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsBoolean()
  affectedByResourcefulness?: boolean;
}

/** Manual correction payload. Any provided field overrides imported Blizzard data. */
export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  outputItemId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  outputQuantityMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  outputQuantityMax?: number;

  @IsOptional()
  @IsBoolean()
  multicraftEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  resourcefulnessEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  concentrationEligible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMaxSize(30)
  @Type(() => RecipeReagentInputDto)
  reagents?: RecipeReagentInputDto[];
}

export class CreateRecipeDto extends UpdateRecipeDto {
  @IsInt()
  professionId!: number;

  @IsOptional()
  @IsInt()
  skillTierId?: number;
}

export class ImportRecipesDto {
  /** Blizzard profession id (171 = Alchemy). */
  @IsOptional()
  @IsInt()
  professionId?: number;

  /** Explicit skill tier id; otherwise selects only a tier matching TARGET_EXPANSION_NAME. */
  @IsOptional()
  @IsInt()
  skillTierId?: number;
}

export class CatalogItemDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsString()
  @MaxLength(200)
  name!: string;
}

export class ForeverBetaReagentDto {
  @ValidateNested()
  @Type(() => CatalogItemDto)
  item!: CatalogItemDto;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}

export class ForeverBetaRecipeDto {
  @IsString()
  @MaxLength(100)
  externalId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @ValidateNested()
  @Type(() => CatalogItemDto)
  outputItem!: CatalogItemDto;

  @IsInt()
  @Min(1)
  outputQuantityMin!: number;

  @IsInt()
  @Min(1)
  outputQuantityMax!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ForeverBetaReagentDto)
  reagents!: ForeverBetaReagentDto[];
}

export class ImportClassicForeverCatalogDto {
  @IsInt()
  @Min(1)
  professionId!: number;

  @IsString()
  @MaxLength(100)
  professionName!: string;

  @IsInt()
  @Min(1)
  skillTierId!: number;

  @IsString()
  @MaxLength(150)
  skillTierName!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSkill?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSkill?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  catalogVersion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ForeverBetaRecipeDto)
  recipes!: ForeverBetaRecipeDto[];
}

export class ListRecipesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  professionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  skillTierId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  incomplete?: string;
}
