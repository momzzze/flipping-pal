import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

  /** Explicit skill tier id; defaults to the tier matching TARGET_EXPANSION_NAME, else the newest. */
  @IsOptional()
  @IsInt()
  skillTierId?: number;
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
