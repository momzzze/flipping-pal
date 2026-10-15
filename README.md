# Azeroth Flip

**World of Warcraft Auction House & profession crafting profit analyzer** — initially targeting **WoW: Midnight** and the **EU** region, with a data model designed to grow with future expansions.

Azeroth Flip pulls current Auction House prices from the official Blizzard Game Data API, maps profession recipes to their reagents and output items, and tells you which crafts are profitable right now:

> A potion needs 2 × Herb A and 1 × Herb B. Azeroth Flip buys those reagents through the cheapest current listings (walking up the price tiers for larger batches), compares the total against the potion's selling price, deducts the 5 % AH cut and shows the expected **net profit** and **ROI**.

The first fully implemented workflow is **Alchemy + EU commodity prices**: Battle.net OAuth → recipe import → auction snapshot → profit engine → dashboard.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Windows setup (step by step)](#windows-setup-step-by-step)
- [macOS / Linux quick start](#macos--linux-quick-start)
- [Running everything in Docker](#running-everything-in-docker)
- [Getting Blizzard API credentials](#getting-blizzard-api-credentials)
- [Live data vs. sample data](#live-data-vs-sample-data)
- [How profit is calculated](#how-profit-is-calculated)
- [REST API](#rest-api)
- [Configuration reference](#configuration-reference)
- [Testing, linting and building](#testing-linting-and-building)
- [Project structure](#project-structure)
- [Known limitations & remaining work](#known-limitations--remaining-work)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area | What is implemented |
| --- | --- |
| Blizzard integration | OAuth **client credentials** flow (token cached and refreshed automatically), Game Data API client with request throttling, retry with exponential back-off on `429`/`5xx` (honours `Retry-After`), one automatic token refresh on `401`, `If-Modified-Since` support for auction endpoints, in-memory caching of static data. Credentials stay server-side in environment variables. |
| Auctions | EU region-wide **commodity** auctions and selected **connected-realm** auctions. Listings are aggregated per item into price tiers (unit price → quantity), min / median / market price, supply and listing counts. |
| Recipes | Import of professions, the target expansion skill tier (Midnight), recipes, reagents, output items and crafting quantities into a normalized schema. Incomplete mappings are flagged and can be **corrected manually** in the UI; manual corrections are protected from being overwritten by future imports. |
| Profit engine | Material cost from current price tiers, expected revenue, AH fee, net profit and ROI. Large batches walk up the reagent price tiers, insufficient supply is flagged, missing prices never become fake zeros. Multicraft and resourcefulness expectations are applied to eligible recipes. Covered by unit tests. |
| Dashboard | Dark-themed UI with top navigation, filter sidebar, large sortable results table (icon, item name/quality, material cost, sell price, AH fee, profit, ROI, supply/listings, reagent depth) and a recipe details panel (materials, per-reagent tier pricing, revenue breakdown, profit trend). |
| Filters | Profession, expansion, output quality, minimum profit per craft, minimum ROI, minimum output supply, number of crafts, sell-price strategy (lowest listing / market), connected realm, incomplete recipes, watchlist only, free-text search. |
| History | Every auction refresh stores an `AuctionSnapshot` with per-item `ItemPriceSnapshot`s in PostgreSQL, enabling item price history and recipe profit history endpoints (profit trend sparkline in the UI). |
| Supply ≠ demand | Supply (units listed) and listing counts are always shown separately and labeled as such. Active listings are **never** treated as sales. |
| Watchlist | Star recipes to track them in a dedicated Watchlist view. |
| Future mechanics | Schema fields for multicraft, resourcefulness, concentration eligibility, reagent crafting quality and per-profession crafting modifier profiles. |
| Robustness | Loading skeletons, error states with retry, Blizzard rate-limit handling, API response caching (profit table cached for 60 s, invalidated on data changes), validation of every request DTO. |

---

## Architecture

```
flipping-pal/
├── api/                 NestJS REST API (TypeScript, Prisma, PostgreSQL)
│   ├── prisma/          schema.prisma + migrations
│   └── src/
│       ├── blizzard/    OAuth + Game Data API client, throttling, retries
│       ├── auctions/    commodity / realm auction ingestion, snapshots, scheduler, connected realms
│       ├── items/       item catalogue (names, quality, icons)
│       ├── professions/ professions, skill tiers, expansions
│       ├── recipes/     recipe import + manual correction
│       ├── pricing/     resolves the price snapshot to use (LIVE first, SAMPLE fallback)
│       ├── crafting/    profit engine (pure functions) + profit table / breakdown endpoints
│       ├── analytics/   item price history, recipe profit history
│       ├── watchlist/   favorites
│       ├── sample/      explicitly labeled sample dataset (fallback only)
│       └── status/      health, status, one-click sync
├── web/                 React + Vite + TypeScript + Tailwind CSS + shadcn/ui
│   └── src/
│       ├── components/  dashboard, table, filters, details panel, editor, settings
│       │   └── ui/      shadcn/ui primitives (button, select, table, …)
│       ├── hooks/       TanStack Query hooks
│       └── lib/         API client, types, formatting
├── docker-compose.yml   PostgreSQL, optional Redis, API and web containers
└── .env.example         variables for docker compose
```

**Data flow**

1. `BlizzardApiService` obtains an OAuth token from `https://oauth.battle.net/token` (client credentials) and calls `https://eu.api.blizzard.com` with the `static-eu` / `dynamic-eu` namespaces.
2. `RecipesService` imports the Alchemy skill tier of the target expansion: recipe → reagents → crafted item (+ quantities). Items are enriched with name, quality and icon.
3. `AuctionsService` downloads `/data/wow/auctions/commodities`, aggregates listings for every item referenced by a recipe, and stores a snapshot.
4. `CraftingService` combines recipes, the latest snapshot and your crafting modifiers via the pure functions in `profit-engine.ts`.
5. The React app renders the results with TanStack Query (caching, loading/error states) and TanStack Table (sorting).

**Database (Prisma)** — `Expansion`, `Profession`, `SkillTier`, `Item`, `Recipe`, `RecipeReagent`, `ConnectedRealm`, `AuctionSnapshot`, `ItemPriceSnapshot`, `WatchlistEntry`, `CraftingModifierProfile`. Prices are stored in **copper** as `BigInt`.

---

## Windows setup (step by step)

The commands below are for **PowerShell** (Windows 10/11). Run them from the repository folder.

### 1. Install prerequisites

| Tool | Version | Download |
| --- | --- | --- |
| Node.js | **20 LTS or newer** (22 LTS recommended) | <https://nodejs.org/> — use the Windows installer (`.msi`) |
| Docker Desktop | latest, with the **WSL 2** backend | <https://www.docker.com/products/docker-desktop/> |
| Git | latest | <https://git-scm.com/download/win> |

After installing, open a **new** PowerShell window and verify:

```powershell
node --version     # v20.x or newer
npm --version
docker --version
docker compose version
```

Make sure Docker Desktop is **running** (whale icon in the system tray) before continuing.

### 2. Clone the repository

```powershell
git clone https://github.com/momzzze/flipping-pal.git
cd flipping-pal
```

### 3. Create environment files

```powershell
Copy-Item .env.example .env
Copy-Item api\.env.example api\.env
Copy-Item web\.env.example web\.env
```

Open `api\.env` in an editor (e.g. `notepad api\.env`) and, if you have them, fill in:

```dotenv
BLIZZARD_CLIENT_ID=your-client-id
BLIZZARD_CLIENT_SECRET=your-client-secret
```

Leave them empty to explore the app with clearly labeled **sample data**. Never commit `.env` files — they are git-ignored.

### 4. Install dependencies

```powershell
npm install
```

This installs both workspaces (`api` and `web`) and generates the Prisma client.

> The required install scripts (Prisma engines, esbuild) are pre-approved in the root `package.json` (`allowScripts`). If the Prisma client is ever missing, run `npm run prisma:generate --workspace api`.

### 5. Start PostgreSQL and apply migrations

```powershell
npm run db:up        # docker compose up -d postgres
npm run db:migrate   # prisma migrate dev (creates all tables)
```

### 6. Run the API and the web app

Use two PowerShell windows:

```powershell
# window 1
npm run dev:api      # http://localhost:3000/api
```

```powershell
# window 2
npm run dev:web      # http://localhost:5173
```

Open <http://localhost:5173>.

### 7. Load data

- **With Blizzard credentials:** click **Sync Alchemy** in the top bar. This imports the Alchemy recipes for the target expansion and fetches the current EU commodity auctions (the first import makes a few hundred API calls and can take a minute). Afterwards use **Refresh prices** (Blizzard updates commodity data roughly once per hour).
- **Without credentials:** click **Load sample data** in the banner (or run `npm run db:seed-sample`). A yellow **SAMPLE DATA** banner stays visible while sample prices are in use.

### Windows tips

- If port `5432`, `3000` or `5173` is in use, change `POSTGRES_PORT` in `.env` (and the port in `DATABASE_URL` in `api\.env`), `PORT` in `api\.env`, or start Vite with `npm run dev:web -- --port 5174` (and add the new origin to `CORS_ORIGINS`).
- If PowerShell blocks `npm`/`npx` scripts with an execution-policy error, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- To stop the database: `docker compose stop postgres`. To wipe it completely: `docker compose down -v`.

---

## macOS / Linux quick start

```bash
cp .env.example .env && cp api/.env.example api/.env && cp web/.env.example web/.env
npm install
npm run db:up && npm run db:migrate
npm run dev:api     # terminal 1
npm run dev:web     # terminal 2 → http://localhost:5173
```

---

## Running everything in Docker

```powershell
Copy-Item .env.example .env    # put BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET here for Docker
docker compose up -d --build
```

- Web UI: <http://localhost:5173> (nginx serving the built app and proxying `/api` to the API container)
- API: <http://localhost:3000/api>
- Migrations are applied automatically (`prisma migrate deploy`) when the API container starts.
- Optional Redis for future BullMQ jobs: `docker compose --profile queue up -d redis`.

---

## Getting Blizzard API credentials

1. Sign in at <https://develop.battle.net/access/clients> with your Battle.net account.
2. **Create Client** → any name, no redirect URL needed, tick *I do not have a service URL*.
3. Copy the **Client ID** and **Client Secret** into `api\.env` (local dev) or `.env` (Docker).
4. Restart the API. The Settings page should show *Blizzard API credentials: Configured*.

The secret is only read by the NestJS server; it is never sent to the browser.

---

## Live data vs. sample data

| Mode | When | How it is shown |
| --- | --- | --- |
| **LIVE** | A snapshot fetched from the Blizzard API exists | Green `LIVE · x min ago` badge |
| **SAMPLE** | No live snapshot exists and sample data was loaded | Yellow `SAMPLE DATA` badge, warning banner, `sample` tags on every row, items prefixed with `[Sample]` |
| **NONE** | No price data at all | Onboarding banner with *Sync* / *Load sample data* actions |

Sample data consists of **fictional** items (IDs ≥ 9,000,000, names prefixed with `[Sample]`) and generated prices. It exists only to demonstrate the workflow when credentials or recipe mappings are unavailable. Live snapshots always take precedence and are never mixed with sample prices. Remove sample data under **Settings → Sample data** or `DELETE /api/sample`.

---

## How profit is calculated

All prices are in **copper** (1 g = 100 s = 10,000 c).

```
materialCost   = Σ cost of buying (quantityPerCraft × crafts × resourcefulnessFactor) units of each required reagent,
                 walking up the current price tiers (cheapest listings first)
expectedOutput = outputQuantityPerCraft × crafts × (1 + multicraftChance × multicraftYieldBonus)   (if multicraft eligible)
grossRevenue   = expectedOutput × sellUnitPrice            (lowest listing or "market" = avg of cheapest 10 %)
ahFee          = grossRevenue × 5 %                         (AH_CUT_RATE)
netProfit      = grossRevenue − ahFee − materialCost
ROI            = netProfit / materialCost
```

- **Price tiers:** buying 500 herbs when only 200 are listed at the lowest price correctly costs more than `500 × min price`. The details panel shows the average and the highest ("up to") unit price reached.
- **Insufficient supply:** if not enough units are listed, the remaining units are estimated at the highest listed price and the row is flagged.
- **Missing prices:** if any required reagent or the output has no listings, profit is shown as unknown (`—`), never as a misleading number.
- **Optional reagents** are excluded from the cost.
- **Supply vs. demand:** *Supply* is the number of units currently listed; *listings* is the number of auctions. Neither measures how much actually sells.
- **Reagent depth:** how many crafts the currently listed reagent supply could cover.
- **Crafting modifiers** (Settings): multicraft chance/yield and resourcefulness chance/savings per profession, applied only to recipes flagged as eligible.

The engine lives in [`api/src/crafting/profit-engine.ts`](api/src/crafting/profit-engine.ts) and is fully unit tested.

---

## REST API

Base URL: `http://localhost:3000/api`. All money values are copper integers.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| GET | `/status` | Region, data mode (LIVE / SAMPLE / NONE), latest snapshots, recipe counts |
| POST | `/sync` | Import Alchemy (or `{ "professionId" }`) recipes and force-refresh commodity prices |
| GET | `/professions` | Imported professions with skill tiers and recipe counts |
| GET | `/professions/remote` | Profession index from Blizzard |
| POST | `/professions/:id/import` | Import a profession's target-expansion recipes |
| GET | `/expansions` | Known expansions |
| GET | `/recipes` | List recipes (`professionId`, `skillTierId`, `search`, `incomplete=true`) |
| POST | `/recipes` | Create a manual recipe |
| POST | `/recipes/import` | Import recipes (`{ professionId?, skillTierId? }`, defaults to Alchemy) |
| GET / PATCH / DELETE | `/recipes/:id` | Get / manually correct / delete (non-Blizzard) a recipe |
| POST | `/recipes/:id/reset-manual` | Allow a corrected recipe to be overwritten by the next import |
| GET | `/items?q=` | Search items by name or ID |
| GET | `/items/:id` | Item details |
| POST | `/items/:id/sync` | Re-import item metadata from Blizzard |
| POST | `/auctions/commodities/refresh?force=true` | Fetch EU commodity auctions and store a snapshot |
| POST | `/auctions/realms/:connectedRealmId/refresh` | Fetch a connected realm's auctions |
| GET | `/auctions/snapshots` | Recent snapshots |
| GET | `/connected-realms` · POST `/connected-realms/sync` | Connected realm list / import from Blizzard |
| GET | `/pricing/items/:id?realmId=` | Current price summary and tiers for an item |
| GET | `/crafting/profits` | Profit table. Query: `professionId`, `skillTierId`, `expansionId`, `quality` (CSV), `minProfit` (copper per craft), `minRoi` (%), `minSupply`, `includeIncomplete`, `watchlistOnly`, `crafts`, `realmId`, `sellPriceStrategy` (`MIN`/`MARKET`), `search` |
| GET | `/crafting/recipes/:id` | Full breakdown of one recipe (`crafts`, `realmId`, `sellPriceStrategy`) |
| GET / PUT | `/crafting/modifiers/:professionId` | Crafting modifier profile |
| GET | `/analytics/items/:id/history?days=7` | Item price history |
| GET | `/analytics/recipes/:id/history?days=7` | Recipe profit history (per craft) |
| GET / POST | `/watchlist` | List / add `{ "recipeId" }` |
| DELETE | `/watchlist/:recipeId` | Remove from watchlist |
| POST | `/sample/load` · DELETE `/sample` | Load / remove the labeled sample dataset |

Errors use the JSON shape `{ statusCode, error, message }`. Blizzard rate limits that persist after automatic retries surface as `429` (`BlizzardRateLimited`), other upstream failures as `502`, and missing credentials as `503` (`BlizzardCredentialsMissing`).

Example:

```powershell
Invoke-RestMethod "http://localhost:3000/api/crafting/profits?minRoi=10&crafts=20" | ConvertTo-Json -Depth 5
```

---

## Configuration reference

`api/.env` (see [`api/.env.example`](api/.env.example)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local docker Postgres | PostgreSQL connection string |
| `PORT` | `3000` | API port |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins (comma separated) |
| `BLIZZARD_CLIENT_ID` / `BLIZZARD_CLIENT_SECRET` | empty | Battle.net API client. Empty = sample mode only |
| `BLIZZARD_REGION` | `eu` | API region |
| `BLIZZARD_LOCALE` | `en_GB` | Locale for names |
| `TARGET_EXPANSION_NAME` | `Midnight` | Skill tier to import (matched by name; falls back to the newest tier) |
| `BLIZZARD_MAX_CONCURRENCY` / `BLIZZARD_MAX_REQUESTS_PER_SECOND` / `BLIZZARD_MAX_RETRIES` | `8` / `50` / `4` | Client-side throttling |
| `AH_CUT_RATE` | `0.05` | Auction House cut |
| `AUCTION_REFRESH_INTERVAL_MINUTES` | `0` | Automatic commodity refresh (0 = off; 60 recommended) |
| `REDIS_URL` | — | Reserved for future BullMQ jobs |

`web/.env`: `VITE_API_BASE_URL` (empty = same-origin `/api`, served by the Vite dev proxy or the nginx container). The dev proxy target can be changed with the `VITE_PROXY_TARGET` shell environment variable (default `http://localhost:3000`).

Root `.env`: variables used by `docker-compose.yml` (database credentials, ports, Blizzard credentials for the API container).

---

## Testing, linting and building

```powershell
npm test             # API (Jest) + web (Vitest)
npm run lint         # ESLint for both workspaces
npm run build        # nest build + vite build
```

Per workspace:

```powershell
npm run test --workspace api       # profit engine, auction aggregation, Blizzard client, expansion utils
npm run test --workspace web       # formatting + query-string helpers
npm run typecheck --workspace web
```

---

## Project structure

See [Architecture](#architecture). Key files:

- [`api/prisma/schema.prisma`](api/prisma/schema.prisma) — data model
- [`api/src/crafting/profit-engine.ts`](api/src/crafting/profit-engine.ts) — calculations (+ `profit-engine.spec.ts`)
- [`api/src/blizzard/blizzard-api.service.ts`](api/src/blizzard/blizzard-api.service.ts) — OAuth + Game Data API client
- [`api/src/recipes/recipes.service.ts`](api/src/recipes/recipes.service.ts) — recipe import and manual corrections
- [`api/src/auctions/auction-aggregation.ts`](api/src/auctions/auction-aggregation.ts) — listings → price tiers
- [`web/src/components/ProfitTable.tsx`](web/src/components/ProfitTable.tsx), [`RecipeDetailsPanel.tsx`](web/src/components/RecipeDetailsPanel.tsx), [`FilterSidebar.tsx`](web/src/components/FilterSidebar.tsx)

---

## Known limitations & remaining work

The MVP prioritizes a working Alchemy + EU commodity workflow. Not yet implemented:

- **Reagent quality variants.** Dragonflight-style crafting uses separate item IDs per reagent quality (rank 1/2/3). Blizzard's recipe endpoint lists one reagent item; quality alternatives and "cheapest quality" selection still need a mapping table (`Item.craftingQuality` is stored, the UI marks ranks with ★).
- **Output quality / concentration math.** Concentration eligibility is stored but not yet used; skill-based output quality probabilities are not modeled.
- **Optional/finishing reagents and modified (quality-slot) reagents** are imported only as far as the Blizzard API exposes them; some recipes will be flagged *incomplete* and need manual correction.
- **Midnight skill tier detection** is by name (`TARGET_EXPANSION_NAME`). Before Blizzard publishes Midnight data, the newest available tier is used.
- **Realm (non-commodity) items** with bonus IDs/item levels are aggregated by base item ID only.
- **Sales velocity / demand** is not available from the Blizzard API. Supply is shown, demand is not estimated; a future version could infer it from snapshot-to-snapshot listing disappearance (with appropriate caveats).
- **Deposits** and undercut/re-list costs are not included.
- **Scheduled jobs** use a simple in-process interval (`AUCTION_REFRESH_INTERVAL_MINUTES`). Redis/BullMQ is provisioned in Docker Compose (profile `queue`) but not wired yet.
- **Snapshot retention**: snapshots are kept indefinitely (only tracked items are stored, so growth is modest). A pruning job is still to do.
- **Other professions** can be imported via `POST /api/professions/:id/import`, but the UI's one-click sync targets Alchemy.
- `npm audit` reports a dev-time advisory in a transitive dependency of the Prisma CLI (`deepmerge-ts` via `@prisma/config`); it does not ship in the runtime bundle.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Can't reach database server at localhost:5432` | Start Docker Desktop, then `npm run db:up`. Check `DATABASE_URL` in `api\.env`. |
| `@prisma/client did not initialize yet` | `npm run prisma:generate --workspace api` |
| UI shows "Cannot reach the Azeroth Flip API" | Is `npm run dev:api` running on port 3000? |
| `503 Blizzard API credentials are not configured` | Fill `BLIZZARD_CLIENT_ID` / `BLIZZARD_CLIENT_SECRET` and restart the API. |
| `401` from Blizzard | Wrong client ID/secret, or the client was deleted. |
| `429 Too Many Requests` | Blizzard rate limit — the client retries automatically; wait a minute and try again, or lower `BLIZZARD_MAX_REQUESTS_PER_SECOND`. |
| New reagents show no price after editing a recipe | Only items referenced by recipes are stored in snapshots. Click **Refresh prices** (Settings → *Force commodity refresh*). |

---

## License

See [LICENSE](LICENSE). World of Warcraft and Battle.net are trademarks of Blizzard Entertainment, Inc. This project is not affiliated with Blizzard.
