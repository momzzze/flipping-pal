import {
  calculateAhFee,
  calculatePurchaseCost,
  calculateRecipeProfit,
  expectedOutputQuantity,
  normalizeTiers,
  NO_MODIFIERS,
  requiredReagentQuantity,
} from './profit-engine';

const GOLD = 10_000;

describe('normalizeTiers', () => {
  it('sorts ascending, merges equal prices and drops invalid tiers', () => {
    expect(
      normalizeTiers([
        { unitPrice: 300, quantity: 5 },
        { unitPrice: 100, quantity: 2 },
        { unitPrice: 300, quantity: 1 },
        { unitPrice: 200, quantity: 0 },
        { unitPrice: -1, quantity: 3 },
      ]),
    ).toEqual([
      { unitPrice: 100, quantity: 2 },
      { unitPrice: 300, quantity: 6 },
    ]);
  });
});

describe('calculatePurchaseCost', () => {
  const tiers = [
    { unitPrice: 120, quantity: 10 },
    { unitPrice: 100, quantity: 5 },
    { unitPrice: 150, quantity: 100 },
  ];

  it('returns null when there are no listings', () => {
    expect(calculatePurchaseCost([], 5)).toBeNull();
  });

  it('buys from the cheapest tier first', () => {
    const result = calculatePurchaseCost(tiers, 3);
    expect(result).toMatchObject({
      totalCost: 300,
      averageUnitPrice: 100,
      marginalUnitPrice: 100,
      filledQuantity: 3,
      isFullyFilled: true,
    });
  });

  it('walks up multiple price tiers for larger quantities', () => {
    // 5 @ 100 + 10 @ 120 + 5 @ 150 = 500 + 1200 + 750
    const result = calculatePurchaseCost(tiers, 20);
    expect(result?.totalCost).toBe(2450);
    expect(result?.averageUnitPrice).toBeCloseTo(122.5);
    expect(result?.marginalUnitPrice).toBe(150);
    expect(result?.isFullyFilled).toBe(true);
  });

  it('flags insufficient supply and estimates the remainder at the highest price', () => {
    const result = calculatePurchaseCost([{ unitPrice: 10, quantity: 2 }], 5);
    expect(result).toMatchObject({
      filledQuantity: 2,
      requestedQuantity: 5,
      totalCost: 50,
      isFullyFilled: false,
    });
  });

  it('handles zero quantity', () => {
    expect(calculatePurchaseCost(tiers, 0)?.totalCost).toBe(0);
  });

  it('rejects non-integer quantities', () => {
    expect(() => calculatePurchaseCost(tiers, 1.5)).toThrow(RangeError);
  });
});

describe('calculateAhFee', () => {
  it('deducts the 5% Auction House cut', () => {
    expect(calculateAhFee(100 * GOLD, 0.05)).toBe(5 * GOLD);
  });

  it('rounds to whole copper', () => {
    expect(calculateAhFee(1234, 0.05)).toBe(62);
  });
});

describe('calculateRecipeProfit', () => {
  // Potion requires 2x Herb A and 1x Herb B.
  const herbA = {
    itemId: 1,
    quantityPerCraft: 2,
    tiers: [{ unitPrice: 10 * GOLD, quantity: 1000 }],
  };
  const herbB = {
    itemId: 2,
    quantityPerCraft: 1,
    tiers: [{ unitPrice: 15 * GOLD, quantity: 1000 }],
  };

  it('computes material cost, AH fee, net profit and ROI for a simple recipe', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA, herbB],
      output: { minUnitPrice: 50 * GOLD, marketUnitPrice: 55 * GOLD },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    // cost = 2*10g + 15g = 35g ; revenue = 50g ; fee = 2.5g ; profit = 12.5g ; ROI = 12.5/35
    expect(result.materialCost).toBe(35 * GOLD);
    expect(result.grossRevenue).toBe(50 * GOLD);
    expect(result.ahFee).toBe(2.5 * GOLD);
    expect(result.netRevenue).toBe(47.5 * GOLD);
    expect(result.netProfit).toBe(12.5 * GOLD);
    expect(result.roi).toBeCloseTo(12.5 / 35);
    expect(result.missingReagentPrices).toEqual([]);
    expect(result.missingOutputPrice).toBe(false);
  });

  it('reports negative profit for unprofitable recipes', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA, herbB],
      output: { minUnitPrice: 30 * GOLD, marketUnitPrice: 30 * GOLD },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    expect(result.netProfit).toBe(30 * GOLD - 1.5 * GOLD - 35 * GOLD);
    expect(result.roi).toBeLessThan(0);
  });

  it('uses the market price when requested', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA],
      output: { minUnitPrice: 50 * GOLD, marketUnitPrice: 60 * GOLD },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
      sellPriceStrategy: 'MARKET',
    });
    expect(result.sellUnitPrice).toBe(60 * GOLD);
  });

  it('multiplies by crafted quantity per craft and number of crafts', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA],
      output: { minUnitPrice: 15 * GOLD, marketUnitPrice: 15 * GOLD },
      outputQuantityPerCraft: 2,
      crafts: 10,
      ahCutRate: 0.05,
    });
    expect(result.materialCost).toBe(20 * 10 * GOLD);
    expect(result.expectedOutputQuantity).toBe(20);
    expect(result.grossRevenue).toBe(300 * GOLD);
    expect(result.netProfitPerCraft).toBe(((285 - 200) * GOLD) / 10);
  });

  it('accounts for price tiers when buying reagents for many crafts', () => {
    const thinMarket = {
      itemId: 3,
      quantityPerCraft: 2,
      tiers: [
        { unitPrice: 100, quantity: 4 },
        { unitPrice: 200, quantity: 4 },
        { unitPrice: 400, quantity: 100 },
      ],
    };
    const one = calculateRecipeProfit({
      reagents: [thinMarket],
      output: { minUnitPrice: 1000, marketUnitPrice: 1000 },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    const five = calculateRecipeProfit({
      reagents: [thinMarket],
      output: { minUnitPrice: 1000, marketUnitPrice: 1000 },
      outputQuantityPerCraft: 1,
      crafts: 5,
      ahCutRate: 0.05,
    });
    expect(one.materialCostPerCraft).toBe(200);
    // 10 units: 4*100 + 4*200 + 2*400 = 2000 => 400 per craft
    expect(five.materialCost).toBe(2000);
    expect(five.materialCostPerCraft).toBe(400);
    expect(five.reagents[0].purchase?.marginalUnitPrice).toBe(400);
  });

  it('flags insufficient reagent supply', () => {
    const result = calculateRecipeProfit({
      reagents: [
        {
          itemId: 9,
          quantityPerCraft: 5,
          tiers: [{ unitPrice: 1, quantity: 3 }],
        },
      ],
      output: { minUnitPrice: 100, marketUnitPrice: 100 },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    expect(result.insufficientReagentSupply).toBe(true);
  });

  it('returns null profit when a reagent price is missing', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA, { itemId: 42, quantityPerCraft: 1 }],
      output: { minUnitPrice: 50 * GOLD, marketUnitPrice: 50 * GOLD },
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    expect(result.materialCost).toBeNull();
    expect(result.netProfit).toBeNull();
    expect(result.roi).toBeNull();
    expect(result.missingReagentPrices).toEqual([42]);
  });

  it('returns null revenue when the output has no listings', () => {
    const result = calculateRecipeProfit({
      reagents: [herbA],
      output: null,
      outputQuantityPerCraft: 1,
      crafts: 1,
      ahCutRate: 0.05,
    });
    expect(result.materialCost).toBe(20 * GOLD);
    expect(result.grossRevenue).toBeNull();
    expect(result.netProfit).toBeNull();
    expect(result.missingOutputPrice).toBe(true);
  });

  it('applies multicraft and resourcefulness only when eligible', () => {
    const modifiers = {
      multicraftChance: 0.2,
      multicraftYieldBonus: 1.5,
      resourcefulnessChance: 0.25,
      resourcefulnessSavings: 0.4,
    };
    const base = {
      reagents: [{ ...herbA, quantityPerCraft: 10 }],
      output: { minUnitPrice: 100 * GOLD, marketUnitPrice: 100 * GOLD },
      outputQuantityPerCraft: 1,
      crafts: 10,
      ahCutRate: 0.05,
      modifiers,
    };
    const ineligible = calculateRecipeProfit(base);
    expect(ineligible.expectedOutputQuantity).toBe(10);
    expect(ineligible.reagents[0].requiredQuantity).toBe(100);

    const eligible = calculateRecipeProfit({
      ...base,
      multicraftEligible: true,
      resourcefulnessEligible: true,
    });
    // output: 10 * (1 + 0.2 * 1.5) = 13 ; reagents: 100 * (1 - 0.25 * 0.4) = 90
    expect(eligible.expectedOutputQuantity).toBeCloseTo(13);
    expect(eligible.reagents[0].requiredQuantity).toBe(90);
    expect(eligible.netProfit!).toBeGreaterThan(ineligible.netProfit!);
  });

  it('rejects zero crafts', () => {
    expect(() =>
      calculateRecipeProfit({
        reagents: [herbA],
        output: null,
        outputQuantityPerCraft: 1,
        crafts: 0,
        ahCutRate: 0.05,
      }),
    ).toThrow(RangeError);
  });
});

describe('modifier helpers', () => {
  it('expectedOutputQuantity ignores modifiers when not eligible', () => {
    expect(
      expectedOutputQuantity(
        2,
        3,
        { ...NO_MODIFIERS, multicraftChance: 1, multicraftYieldBonus: 1 },
        false,
      ),
    ).toBe(6);
  });

  it('requiredReagentQuantity rounds up partial units', () => {
    expect(
      requiredReagentQuantity(
        3,
        1,
        {
          ...NO_MODIFIERS,
          resourcefulnessChance: 0.5,
          resourcefulnessSavings: 0.5,
        },
        true,
      ),
    ).toBe(3); // 3 * 0.75 = 2.25 -> 3
  });

  it('clamps out-of-range chances', () => {
    expect(
      requiredReagentQuantity(
        10,
        1,
        {
          ...NO_MODIFIERS,
          resourcefulnessChance: 5,
          resourcefulnessSavings: 0.5,
        },
        true,
      ),
    ).toBe(5);
  });
});
