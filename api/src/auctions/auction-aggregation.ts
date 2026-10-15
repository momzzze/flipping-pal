import { PriceTier } from '../crafting/profit-engine';

/** A normalized auction listing (commodity or realm). Prices in copper. */
export interface Listing {
  itemId: number;
  quantity: number;
  unitPrice: number;
}

export interface ItemPriceAggregate {
  itemId: number;
  minUnitPrice: number;
  /** Quantity-weighted average of the cheapest MARKET_DEPTH share of supply. */
  marketUnitPrice: number;
  /** Quantity-weighted median unit price. */
  medianUnitPrice: number;
  totalQuantity: number;
  listingCount: number;
  priceTiers: PriceTier[];
}

export const MARKET_DEPTH = 0.1;
export const MAX_STORED_TIERS = 250;

/**
 * Groups listings by item and builds ascending price tiers plus summary statistics.
 * Listings represent SUPPLY only; they say nothing about how many units actually sell.
 */
export function aggregateListings(
  listings: Iterable<Listing>,
  include?: (itemId: number) => boolean,
  maxTiers = MAX_STORED_TIERS,
): Map<number, ItemPriceAggregate> {
  const grouped = new Map<
    number,
    { tiers: Map<number, number>; listings: number }
  >();
  for (const listing of listings) {
    if (listing.quantity <= 0 || listing.unitPrice <= 0) continue;
    if (include && !include(listing.itemId)) continue;
    let entry = grouped.get(listing.itemId);
    if (!entry) {
      entry = { tiers: new Map(), listings: 0 };
      grouped.set(listing.itemId, entry);
    }
    entry.listings += 1;
    entry.tiers.set(
      listing.unitPrice,
      (entry.tiers.get(listing.unitPrice) ?? 0) + listing.quantity,
    );
  }

  const result = new Map<number, ItemPriceAggregate>();
  for (const [itemId, entry] of grouped) {
    const tiers = [...entry.tiers.entries()]
      .sort(([a], [b]) => a - b)
      .map(([unitPrice, quantity]) => ({ unitPrice, quantity }));
    const totalQuantity = tiers.reduce((sum, tier) => sum + tier.quantity, 0);
    result.set(itemId, {
      itemId,
      minUnitPrice: tiers[0].unitPrice,
      marketUnitPrice: weightedAverageOfCheapest(
        tiers,
        Math.max(1, Math.ceil(totalQuantity * MARKET_DEPTH)),
      ),
      medianUnitPrice: quantileUnitPrice(tiers, totalQuantity, 0.5),
      totalQuantity,
      listingCount: entry.listings,
      priceTiers: tiers.slice(0, maxTiers),
    });
  }
  return result;
}

function weightedAverageOfCheapest(tiers: PriceTier[], units: number): number {
  let remaining = units;
  let cost = 0;
  for (const tier of tiers) {
    const take = Math.min(remaining, tier.quantity);
    cost += take * tier.unitPrice;
    remaining -= take;
    if (remaining === 0) break;
  }
  return Math.round(cost / (units - remaining));
}

function quantileUnitPrice(
  tiers: PriceTier[],
  totalQuantity: number,
  quantile: number,
): number {
  const target = Math.max(1, Math.ceil(totalQuantity * quantile));
  let seen = 0;
  for (const tier of tiers) {
    seen += tier.quantity;
    if (seen >= target) return tier.unitPrice;
  }
  return tiers[tiers.length - 1].unitPrice;
}
