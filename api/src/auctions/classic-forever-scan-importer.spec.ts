import { parseClassicForeverSavedVariables } from './classic-forever-scan-importer';

describe('parseClassicForeverSavedVariables', () => {
  it('parses the saved global and numeric scan/item arrays', () => {
    const parsed = parseClassicForeverSavedVariables(`
      AzerothFlipScannerDB = {
        ["region"] = "US",
        ["scans"] = {
          [1] = {
            ["scanId"] = "scan-1",
            ["game"] = "Classic Forever",
            ["region"] = "US",
            ["realm"] = "Classic Beta PvP 2",
            ["scannedAt"] = 100,
            ["items"] = {
              [1] = {
                ["itemId"] = 123,
                ["name"] = "Test herb",
                ["priceTiers"] = {
                  [1] = { ["unitPriceCopper"] = 45, ["quantity"] = 3, ["listingCount"] = 2 },
                },
              },
            },
          },
        },
      }
    `);

    const scans = parsed.scans as Array<Record<string, unknown>>;
    expect(scans).toHaveLength(1);
    expect(scans[0].scanId).toBe('scan-1');
    expect(scans[0].realm).toBe('Classic Beta PvP 2');
    const items = scans[0].items as Array<Record<string, unknown>>;
    expect(items[0].itemId).toBe(123);
  });
});