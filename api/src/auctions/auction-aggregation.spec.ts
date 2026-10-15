import { aggregateListings } from './auction-aggregation';

describe('aggregateListings', () => {
  const listings = [
    { itemId: 1, quantity: 10, unitPrice: 300 },
    { itemId: 1, quantity: 5, unitPrice: 100 },
    { itemId: 1, quantity: 5, unitPrice: 100 },
    { itemId: 1, quantity: 80, unitPrice: 500 },
    { itemId: 2, quantity: 1, unitPrice: 999 },
    { itemId: 3, quantity: 0, unitPrice: 50 },
  ];

  it('builds ascending, merged price tiers and supply statistics', () => {
    const result = aggregateListings(listings);
    const item = result.get(1)!;
    expect(item.priceTiers).toEqual([
      { unitPrice: 100, quantity: 10 },
      { unitPrice: 300, quantity: 10 },
      { unitPrice: 500, quantity: 80 },
    ]);
    expect(item.minUnitPrice).toBe(100);
    expect(item.totalQuantity).toBe(100);
    expect(item.listingCount).toBe(4);
    // cheapest 10% (10 units) all at 100
    expect(item.marketUnitPrice).toBe(100);
    // 50th unit falls in the 500 tier
    expect(item.medianUnitPrice).toBe(500);
  });

  it('ignores empty listings and respects the include filter', () => {
    const result = aggregateListings(listings, (id) => id !== 2);
    expect(result.has(2)).toBe(false);
    expect(result.has(3)).toBe(false);
  });

  it('caps the number of stored tiers', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      itemId: 7,
      quantity: 1,
      unitPrice: i + 1,
    }));
    const item = aggregateListings(many, undefined, 5).get(7)!;
    expect(item.priceTiers).toHaveLength(5);
    expect(item.totalQuantity).toBe(20);
  });
});
