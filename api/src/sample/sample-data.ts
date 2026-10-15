import { ItemQuality } from '@prisma/client';

/**
 * EXPLICITLY LABELED SAMPLE DATA.
 * Fictional items and prices used only when Blizzard credentials or recipe mappings are unavailable.
 * Every sample record is flagged (DataSource.SAMPLE / AuctionSnapshot.isSample) and the UI shows
 * a prominent "SAMPLE DATA" banner. These are NOT real market prices.
 */

export const SAMPLE_ID_BASE = 9_000_000;
export const SAMPLE_SKILL_TIER_ID = SAMPLE_ID_BASE + 171;
export const SAMPLE_PROFESSION = { id: 171, name: 'Alchemy' } as const;
export const SAMPLE_EXPANSION_NAME = 'Midnight';
export const SAMPLE_SNAPSHOT_HOURS = 24;

const GOLD = 10_000;

export interface SampleItem {
  id: number;
  name: string;
  quality: ItemQuality;
  /** Base unit price in copper used to generate fake listings. */
  basePrice: number;
  /** Rough number of units listed. */
  depth: number;
}

export interface SampleRecipe {
  name: string;
  category: string;
  outputItemId: number | null;
  outputQuantity: number;
  reagents: Array<{ itemId: number; quantity: number }>;
  multicraft: boolean;
}

const id = (offset: number): number => SAMPLE_ID_BASE + offset;

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    id: id(1),
    name: '[Sample] Dawnpetal',
    quality: ItemQuality.COMMON,
    basePrice: 8 * GOLD,
    depth: 40_000,
  },
  {
    id: id(2),
    name: '[Sample] Duskroot',
    quality: ItemQuality.COMMON,
    basePrice: 14 * GOLD,
    depth: 25_000,
  },
  {
    id: id(3),
    name: '[Sample] Sunthistle',
    quality: ItemQuality.COMMON,
    basePrice: 22 * GOLD,
    depth: 12_000,
  },
  {
    id: id(4),
    name: '[Sample] Voidcap',
    quality: ItemQuality.UNCOMMON,
    basePrice: 35 * GOLD,
    depth: 6_000,
  },
  {
    id: id(5),
    name: '[Sample] Crystal Vial',
    quality: ItemQuality.COMMON,
    basePrice: Math.round(0.5 * GOLD),
    depth: 90_000,
  },
  {
    id: id(6),
    name: '[Sample] Arcane Residue',
    quality: ItemQuality.COMMON,
    basePrice: 4 * GOLD,
    depth: 30_000,
  },
  {
    id: id(101),
    name: '[Sample] Healing Potion',
    quality: ItemQuality.UNCOMMON,
    basePrice: 10 * GOLD,
    depth: 8_000,
  },
  {
    id: id(102),
    name: '[Sample] Mana Potion',
    quality: ItemQuality.UNCOMMON,
    basePrice: 18 * GOLD,
    depth: 5_000,
  },
  {
    id: id(103),
    name: '[Sample] Flask of Power',
    quality: ItemQuality.RARE,
    basePrice: 260 * GOLD,
    depth: 900,
  },
  {
    id: id(104),
    name: '[Sample] Elixir of Insight',
    quality: ItemQuality.UNCOMMON,
    basePrice: 50 * GOLD,
    depth: 1_200,
  },
  {
    id: id(105),
    name: '[Sample] Phial of Swiftness',
    quality: ItemQuality.RARE,
    basePrice: 175 * GOLD,
    depth: 700,
  },
  {
    id: id(106),
    name: '[Sample] Radiant Gem',
    quality: ItemQuality.EPIC,
    basePrice: 180 * GOLD,
    depth: 25,
  },
  {
    id: id(107),
    name: '[Sample] Potion of Vigor',
    quality: ItemQuality.UNCOMMON,
    basePrice: 40 * GOLD,
    depth: 2_500,
  },
];

export const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    name: '[Sample] Healing Potion',
    category: 'Potions',
    outputItemId: id(101),
    outputQuantity: 3,
    reagents: [
      { itemId: id(1), quantity: 3 },
      { itemId: id(5), quantity: 1 },
    ],
    multicraft: true,
  },
  {
    name: '[Sample] Mana Potion',
    category: 'Potions',
    outputItemId: id(102),
    outputQuantity: 3,
    reagents: [
      { itemId: id(1), quantity: 2 },
      { itemId: id(2), quantity: 2 },
      { itemId: id(5), quantity: 1 },
    ],
    multicraft: true,
  },
  {
    // The canonical example: 2x herb A + 1x herb B.
    name: '[Sample] Potion of Vigor',
    category: 'Potions',
    outputItemId: id(107),
    outputQuantity: 1,
    reagents: [
      { itemId: id(1), quantity: 2 },
      { itemId: id(2), quantity: 1 },
    ],
    multicraft: true,
  },
  {
    name: '[Sample] Flask of Power',
    category: 'Flasks',
    outputItemId: id(103),
    outputQuantity: 1,
    reagents: [
      { itemId: id(3), quantity: 4 },
      { itemId: id(4), quantity: 3 },
      { itemId: id(6), quantity: 2 },
    ],
    multicraft: true,
  },
  {
    name: '[Sample] Elixir of Insight',
    category: 'Elixirs',
    outputItemId: id(104),
    outputQuantity: 2,
    reagents: [
      { itemId: id(2), quantity: 5 },
      { itemId: id(3), quantity: 2 },
    ],
    multicraft: true,
  },
  {
    name: '[Sample] Phial of Swiftness',
    category: 'Phials',
    outputItemId: id(105),
    outputQuantity: 1,
    reagents: [
      { itemId: id(4), quantity: 3 },
      { itemId: id(3), quantity: 2 },
      { itemId: id(6), quantity: 1 },
    ],
    multicraft: true,
  },
  {
    name: '[Sample] Transmute: Radiant Gem',
    category: 'Transmutes',
    outputItemId: id(106),
    outputQuantity: 1,
    reagents: [
      { itemId: id(6), quantity: 10 },
      { itemId: id(4), quantity: 2 },
    ],
    multicraft: false,
  },
  {
    // Deliberately incomplete to demonstrate the manual recipe correction workflow.
    name: '[Sample] Cauldron of Plenty (incomplete)',
    category: 'Cauldrons',
    outputItemId: null,
    outputQuantity: 1,
    reagents: [],
    multicraft: false,
  },
];

/** Deterministic PRNG so sample data is stable between loads. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates fake listings for one item at a given hour offset. */
export function generateSampleListings(
  item: SampleItem,
  index: number,
  hoursAgo: number,
  random: () => number,
): Array<{ itemId: number; quantity: number; unitPrice: number }> {
  const trend =
    1 + 0.08 * Math.sin(hoursAgo / 4 + index) + (random() - 0.5) * 0.04;
  const base = Math.max(1, Math.round(item.basePrice * trend));
  const listings: Array<{
    itemId: number;
    quantity: number;
    unitPrice: number;
  }> = [];
  const tiers = 12;
  for (let tier = 0; tier < tiers; tier += 1) {
    const unitPrice = Math.round(base * (1 + tier * 0.025 + random() * 0.01));
    const share =
      (item.depth / tiers) * (0.4 + random() * 1.2) * (1 + tier * 0.15);
    const quantity = Math.max(1, Math.round(share));
    listings.push({ itemId: item.id, quantity, unitPrice });
  }
  return listings;
}
