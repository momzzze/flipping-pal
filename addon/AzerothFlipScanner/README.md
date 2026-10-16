# Azeroth Flip Scanner

Classic Forever in-game Auction House scanner. It uses the client's `C_AuctionHouse.ReplicateItems()` API, not Blizzard's web API.

## Install

1. Copy the `AzerothFlipScanner` folder into the active Classic Forever client's `Interface/AddOns` folder.
2. At character select, enable **Azeroth Flip Scanner**. If the PTR reports an interface mismatch, enable **Load out of date AddOns** and report the client build so the `.toc` interface number can be updated.
3. Enter the game and open the Auction House.
4. Type `/afscan`, then click **Scan Full Auction House**. This Forever Beta build is tagged as US.
5. Wait for the completion message. Use `/reload` or log out so WoW writes the SavedVariables file.

## Output

WoW saves `AzerothFlipScannerDB` under:

`WTF/Account/<account>/SavedVariables/AzerothFlipScanner.lua`

The saved table contains scan time, region, realm, client build, auction counts, and item IDs grouped into ascending unit-buyout price tiers. The addon records buyout listings only; bid-only listings do not have a known sale price and are skipped.

Full replication is account-throttled by the game to about once every 15 minutes. The addon records the last request time and reports the remaining cooldown. Very large auctions can take time to populate item names; item IDs, quantities, and buyouts are read from the replication results.

The SavedVariables file is not JSON. The app still needs an importer for this output; this addon only collects and saves the data for that next step.