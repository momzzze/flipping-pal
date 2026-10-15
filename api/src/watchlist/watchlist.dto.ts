import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddWatchlistDto {
  @IsInt()
  recipeId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Optional alert threshold for net profit per craft, in copper. */
  @IsOptional()
  @IsInt()
  @Min(0)
  targetProfit?: number;
}
