import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ItemQuality } from '@prisma/client';
import type { SellPriceStrategy } from './profit-engine';

const toBool = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '')
    : value;

export class ProfitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  professionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  skillTierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expansionId?: number;

  /** Comma-separated output item qualities, e.g. "RARE,EPIC". */
  @IsOptional()
  @Transform(toList)
  @IsIn(Object.values(ItemQuality), { each: true })
  quality?: ItemQuality[];

  /** Minimum net profit per craft, in copper. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minProfit?: number;

  /** Minimum ROI in percent (e.g. 15 = 15%). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRoi?: number;

  /** Minimum units of the output item currently listed (supply). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSupply?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeIncomplete?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  watchlistOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  crafts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  realmId?: number;

  @IsOptional()
  @IsIn(['MIN', 'MARKET'])
  sellPriceStrategy?: SellPriceStrategy;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class BreakdownQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  crafts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  realmId?: number;

  @IsOptional()
  @IsIn(['MIN', 'MARKET'])
  sellPriceStrategy?: SellPriceStrategy;
}

export class UpdateModifiersDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  multicraftChance!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  multicraftYieldBonus!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  resourcefulnessChance!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  resourcefulnessSavings!: number;
}
