/**
 * Pure crafting profit engine. All monetary values are in copper (integers).
 *
 * Terminology:
 *  - Price tiers: ascending list of { unitPrice, quantity } built from active AH listings (supply).
 *  - Material cost: cost of buying all required reagents walking up the price tiers.
 *  - Gross revenue: expected output quantity x sell unit price.
 *  - AH fee: Auction House commission on sales (5% by default).
 *  - Net profit: gross revenue - AH fee - material cost.
 *  - ROI: net profit / material cost.
 */

export interface PriceTier {
  unitPrice: number;
  quantity: number;
}

export interface PurchaseResult {
  requestedQuantity: number;
  /** Units that can actually be bought from current listings. */
  filledQuantity: number;
  /** Total cost. Unfilled units are estimated at the highest listed price. */
  totalCost: number;
  averageUnitPrice: number;
  /** Price of the most expensive unit purchased (where the order "lands" in the tiers). */
  marginalUnitPrice: number;
  isFullyFilled: boolean;
}

export interface CraftingModifiers {
  /** 0..1 chance that multicraft procs. */
  multicraftChance: number;
  /** Extra output (as a fraction of base output) when multicraft procs. */
  multicraftYieldBonus: number;
  /** 0..1 chance that resourcefulness procs for a reagent. */
  resourcefulnessChance: number;
  /** 0..1 fraction of a reagent saved when resourcefulness procs. */
  resourcefulnessSavings: number;
}

export const NO_MODIFIERS: CraftingModifiers = {
  multicraftChance: 0,
  multicraftYieldBonus: 0,
  resourcefulnessChance: 0,
  resourcefulnessSavings: 0,
};

export type SellPriceStrategy = 'MIN' | 'MARKET';

export interface ReagentInput {
  itemId: number;
  quantityPerCraft: number;
  /** Ascending price tiers; empty or undefined when no price data exists. */
  tiers?: readonly PriceTier[];
  affectedByResourcefulness?: boolean;
}

export interface OutputPricing {
  minUnitPrice: number;
  marketUnitPrice: number;
}

export interface ProfitInput {
  reagents: readonly ReagentInput[];
  output: OutputPricing | null;
  /** Average units produced per craft (e.g. (min + max) / 2). */
  outputQuantityPerCraft: number;
  crafts: number;
  ahCutRate: number;
  sellPriceStrategy?: SellPriceStrategy;
  modifiers?: CraftingModifiers;
  multicraftEligible?: boolean;
  resourcefulnessEligible?: boolean;
}

export interface ReagentCostBreakdown {
  itemId: number;
  quantityPerCraft: number;
  /** Units to buy after expected resourcefulness savings (rounded up). */
  requiredQuantity: number;
  purchase: PurchaseResult | null;
  hasPrice: boolean;
}

export interface ProfitResult {
  crafts: number;
  reagents: ReagentCostBreakdown[];
  materialCost: number | null;
  materialCostPerCraft: number | null;
  expectedOutputQuantity: number;
  sellUnitPrice: number | null;
  grossRevenue: number | null;
  ahFee: number | null;
  netRevenue: number | null;
  netProfit: number | null;
  netProfitPerCraft: number | null;
  /** Fraction (0.25 = 25%). Null when cost or revenue is unknown or cost is zero. */
  roi: number | null;
  missingReagentPrices: number[];
  missingOutputPrice: boolean;
  /** True when at least one reagent cannot be fully bought from current listings. */
  insufficientReagentSupply: boolean;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `${name} must be a non-negative integer (got ${value})`,
    );
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Sorts tiers ascending, merges duplicate prices and drops invalid entries. */
export function normalizeTiers(tiers: readonly PriceTier[]): PriceTier[] {
  const byPrice = new Map<number, number>();
  for (const tier of tiers) {
    if (!(tier.quantity > 0) || !(tier.unitPrice >= 0)) continue;
    byPrice.set(
      tier.unitPrice,
      (byPrice.get(tier.unitPrice) ?? 0) + tier.quantity,
    );
  }
  return [...byPrice.entries()]
    .sort(([a], [b]) => a - b)
    .map(([unitPrice, quantity]) => ({ unitPrice, quantity }));
}

/**
 * Cost of buying `quantity` units by walking up the price tiers (cheapest first),
 * exactly like the commodity AH fills a buy order.
 */
export function calculatePurchaseCost(
  tiers: readonly PriceTier[],
  quantity: number,
): PurchaseResult | null {
  assertNonNegativeInteger(quantity, 'quantity');
  const sorted = normalizeTiers(tiers);
  if (sorted.length === 0) return null;
  if (quantity === 0) {
    return {
      requestedQuantity: 0,
      filledQuantity: 0,
      totalCost: 0,
      averageUnitPrice: 0,
      marginalUnitPrice: sorted[0].unitPrice,
      isFullyFilled: true,
    };
  }

  let remaining = quantity;
  let totalCost = 0;
  let marginalUnitPrice = sorted[0].unitPrice;
  for (const tier of sorted) {
    if (remaining === 0) break;
    const take = Math.min(remaining, tier.quantity);
    totalCost += take * tier.unitPrice;
    remaining -= take;
    marginalUnitPrice = tier.unitPrice;
  }
  const filledQuantity = quantity - remaining;
  if (remaining > 0) {
    // Not enough supply: estimate the rest at the highest listed price.
    totalCost += remaining * marginalUnitPrice;
  }
  return {
    requestedQuantity: quantity,
    filledQuantity,
    totalCost,
    averageUnitPrice: totalCost / quantity,
    marginalUnitPrice,
    isFullyFilled: remaining === 0,
  };
}

/** Expected units of output, including multicraft when eligible. */
export function expectedOutputQuantity(
  outputQuantityPerCraft: number,
  crafts: number,
  modifiers: CraftingModifiers,
  multicraftEligible: boolean,
): number {
  const base = outputQuantityPerCraft * crafts;
  if (!multicraftEligible) return base;
  const bonus =
    clamp01(modifiers.multicraftChance) *
    Math.max(0, modifiers.multicraftYieldBonus);
  return base * (1 + bonus);
}

/** Units of a reagent that must be bought, including expected resourcefulness savings. */
export function requiredReagentQuantity(
  quantityPerCraft: number,
  crafts: number,
  modifiers: CraftingModifiers,
  resourcefulnessApplies: boolean,
): number {
  const base = quantityPerCraft * crafts;
  if (!resourcefulnessApplies) return base;
  const savings =
    clamp01(modifiers.resourcefulnessChance) *
    clamp01(modifiers.resourcefulnessSavings);
  return Math.ceil(base * (1 - savings) - 1e-9);
}

export function calculateAhFee(
  grossRevenue: number,
  ahCutRate: number,
): number {
  return Math.round(grossRevenue * clamp01(ahCutRate));
}

export function calculateRecipeProfit(input: ProfitInput): ProfitResult {
  assertNonNegativeInteger(input.crafts, 'crafts');
  if (input.crafts === 0) throw new RangeError('crafts must be at least 1');
  const modifiers = input.modifiers ?? NO_MODIFIERS;

  const reagents: ReagentCostBreakdown[] = input.reagents.map((reagent) => {
    const requiredQuantity = requiredReagentQuantity(
      reagent.quantityPerCraft,
      input.crafts,
      modifiers,
      Boolean(input.resourcefulnessEligible) &&
        reagent.affectedByResourcefulness !== false,
    );
    const purchase = reagent.tiers
      ? calculatePurchaseCost(reagent.tiers, requiredQuantity)
      : null;
    return {
      itemId: reagent.itemId,
      quantityPerCraft: reagent.quantityPerCraft,
      requiredQuantity,
      purchase,
      hasPrice: purchase !== null,
    };
  });

  const missingReagentPrices = reagents
    .filter((r) => !r.hasPrice)
    .map((r) => r.itemId);
  const materialCost =
    missingReagentPrices.length === 0
      ? reagents.reduce((sum, r) => sum + (r.purchase?.totalCost ?? 0), 0)
      : null;

  const outputQuantity = expectedOutputQuantity(
    input.outputQuantityPerCraft,
    input.crafts,
    modifiers,
    Boolean(input.multicraftEligible),
  );

  const sellUnitPrice = input.output
    ? input.sellPriceStrategy === 'MARKET'
      ? input.output.marketUnitPrice
      : input.output.minUnitPrice
    : null;
  const grossRevenue =
    sellUnitPrice !== null ? Math.round(sellUnitPrice * outputQuantity) : null;
  const ahFee =
    grossRevenue !== null
      ? calculateAhFee(grossRevenue, input.ahCutRate)
      : null;
  const netRevenue =
    grossRevenue !== null && ahFee !== null ? grossRevenue - ahFee : null;
  const netProfit =
    netRevenue !== null && materialCost !== null
      ? netRevenue - materialCost
      : null;
  const roi =
    netProfit !== null && materialCost !== null && materialCost > 0
      ? netProfit / materialCost
      : null;

  return {
    crafts: input.crafts,
    reagents,
    materialCost,
    materialCostPerCraft:
      materialCost !== null ? materialCost / input.crafts : null,
    expectedOutputQuantity: outputQuantity,
    sellUnitPrice,
    grossRevenue,
    ahFee,
    netRevenue,
    netProfit,
    netProfitPerCraft: netProfit !== null ? netProfit / input.crafts : null,
    roi,
    missingReagentPrices,
    missingOutputPrice: sellUnitPrice === null,
    insufficientReagentSupply: reagents.some(
      (r) => r.purchase !== null && !r.purchase.isFullyFilled,
    ),
  };
}
