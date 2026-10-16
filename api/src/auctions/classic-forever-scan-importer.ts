import { BadRequestException, Injectable } from '@nestjs/common';
import { AuctionScope, DataSource, Prisma, Region } from '@prisma/client';
import { parse } from 'luaparse';
import type { AssignmentStatement, Chunk, Node } from 'luaparse';
import { createHash } from 'node:crypto';
import { CacheService } from '../common/cache.service';
import { aggregateListings, Listing } from './auction-aggregation';
import { PrismaService } from '../prisma/prisma.service';

interface LuaObject {
  [key: string]: LuaValue;
}

interface LuaArray extends Array<LuaValue> {}

type LuaValue = string | number | boolean | null | LuaArray | LuaObject;

interface ImportedItem {
  id: number;
  name: string;
  listingCount: number;
  tiers: Listing[];
}

export interface ClassicForeverScanSummary {
  scanId: string;
  alreadyImported: boolean;
  snapshotId: number;
  realmId: number;
  realm: string;
  auctionCount: number;
  itemCount: number;
}

function isObject(value: LuaValue | undefined): value is LuaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: LuaValue | undefined, description: string): LuaObject {
  if (!isObject(value)) {
    throw new BadRequestException(`${description} must be a Lua table`);
  }
  return value;
}

function asArray(value: LuaValue | undefined, description: string): LuaValue[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${description} must be a Lua array`);
  }
  return value;
}

function asPositiveInt(value: LuaValue | undefined, description: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new BadRequestException(`${description} must be a positive integer`);
  }
  return number;
}

function luaExpressionToValue(node: Node): LuaValue {
  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NilLiteral':
      return node.value;
    case 'TableConstructorExpression': {
      const fields = node.fields;
      const entries: Array<[string | number, LuaValue]> = [];
      let nextArrayIndex = 1;

      for (const field of fields) {
        if (field.type === 'TableValue') {
          entries.push([nextArrayIndex, luaExpressionToValue(field.value)]);
          nextArrayIndex += 1;
        } else if (field.type === 'TableKeyString') {
          entries.push([field.key.name, luaExpressionToValue(field.value)]);
        } else {
          const key = luaExpressionToValue(field.key);
          if (typeof key !== 'string' && typeof key !== 'number') {
            throw new BadRequestException('SavedVariables contains an unsupported table key');
          }
          entries.push([key, luaExpressionToValue(field.value)]);
        }
      }

      if (entries.every(([key]) => typeof key === 'number' && Number.isSafeInteger(key) && key > 0)) {
        const indexes = entries.map(([key]) => key as number).sort((a, b) => a - b);
        if (indexes.every((index, position) => index === position + 1)) {
          return indexes.map((index) => entries.find(([key]) => key === index)![1]);
        }
      }

      const object: LuaObject = {};
      for (const [key, value] of entries) object[String(key)] = value;
      return object;
    }
    case 'UnaryExpression': {
      const value = luaExpressionToValue(node.argument);
      if (node.operator === '-' && typeof value === 'number') return -value;
      if (node.operator === 'not') return !value;
      throw new BadRequestException('SavedVariables contains an unsupported unary expression');
    }
    default:
      throw new BadRequestException(
        `SavedVariables contains unsupported Lua syntax: ${node.type}`,
      );
  }
}

export function parseClassicForeverSavedVariables(source: string): LuaObject {
  let chunk: Chunk;
  try {
    chunk = parse(source, {
      luaVersion: '5.1',
      encodingMode: 'pseudo-latin1',
    });
  } catch (error) {
    throw new BadRequestException(
      `Could not parse SavedVariables Lua: ${(error as Error).message}`,
    );
  }

  const assignment = chunk.body.find(
    (statement): statement is AssignmentStatement =>
      statement.type === 'AssignmentStatement' &&
      statement.variables.some(
        (variable) =>
          variable.type === 'Identifier' &&
          variable.name === 'AzerothFlipScannerDB',
      ),
  );
  const value = assignment?.init[0];
  if (!value) {
    throw new BadRequestException(
      'SavedVariables does not assign AzerothFlipScannerDB.',
    );
  }
  return asRecord(luaExpressionToValue(value), 'AzerothFlipScannerDB');
}

function realmSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function realmIdForSlug(slug: string): number {
  const hash = createHash('sha256').update(`classic-forever-us:${slug}`).digest();
  return 1_000_000_000 + (hash.readUInt32BE(0) % 1_000_000_000);
}

@Injectable()
export class ClassicForeverScanImporter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async importSavedVariables(source: string): Promise<ClassicForeverScanSummary> {
    const database = parseClassicForeverSavedVariables(source);
    const scans = asArray(database.scans, 'AzerothFlipScannerDB.scans');
    if (scans.length === 0) {
      throw new BadRequestException('No scans are saved in this file.');
    }

    const scanRecords = scans.map((scan, index) =>
      asRecord(scan, `scans[${index + 1}]`),
    );
    const latest = scanRecords.reduce((selected, candidate) => {
      const selectedAt = Number(selected.scannedAt) || 0;
      const candidateAt = Number(candidate.scannedAt) || 0;
      return candidateAt >= selectedAt ? candidate : selected;
    });
    const scanId = typeof latest.scanId === 'string' ? latest.scanId : '';
    const realmName = typeof latest.realm === 'string' ? latest.realm.trim() : '';
    const game = typeof latest.game === 'string' ? latest.game : '';
    const region = typeof latest.region === 'string' ? latest.region.toUpperCase() : '';
    if (!scanId || !realmName || !game.toLowerCase().includes('classic forever')) {
      throw new BadRequestException('The latest scan is missing its Classic Forever ID, realm, or game marker.');
    }
    if (region !== 'US') {
      throw new BadRequestException(`Expected a US scan, found region ${region || '(missing)'}.`);
    }

    const rawItems = asArray(latest.items, 'latest scan items');
    const importedItems: ImportedItem[] = [];
    const listings: Listing[] = [];
    let calculatedAuctionCount = 0;
    for (const [index, rawItem] of rawItems.entries()) {
      const item = asRecord(rawItem, `items[${index + 1}]`);
      const id = asPositiveInt(item.itemId, `items[${index + 1}].itemId`);
      const name = typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : `Item ${id}`;
      const priceTiers = asArray(item.priceTiers, `items[${index + 1}].priceTiers`);
      const itemListings: Listing[] = [];
      for (const [tierIndex, rawTier] of priceTiers.entries()) {
        const tier = asRecord(rawTier, `items[${index + 1}].priceTiers[${tierIndex + 1}]`);
        const unitPrice = asPositiveInt(tier.unitPriceCopper, 'tier.unitPriceCopper');
        const quantity = asPositiveInt(tier.quantity, 'tier.quantity');
        itemListings.push({ itemId: id, unitPrice, quantity });
        listings.push({ itemId: id, unitPrice, quantity });
        calculatedAuctionCount += Number(tier.listingCount) || 0;
      }
      if (itemListings.length > 0) {
        importedItems.push({
          id,
          name,
          listingCount: Number(item.listingCount) || itemListings.length,
          tiers: itemListings,
        });
      }
    }
    if (importedItems.length === 0) {
      throw new BadRequestException('The latest scan contains no priced item listings.');
    }

    const aggregates = aggregateListings(listings);
    const slug = realmSlug(realmName);
    if (!slug) throw new BadRequestException('The scan realm name cannot be converted to a realm key.');
    const realmId = realmIdForSlug(slug);
    const scannedAt = Number(latest.scannedAt);
    const fetchedAt = Number.isFinite(scannedAt) && scannedAt > 0
      ? new Date(scannedAt * 1000)
      : new Date();
    const auctionCount = Number(latest.listingsWithBuyout) || calculatedAuctionCount;

    const result = await this.prisma.$transaction(async (tx) => {
      const existingSnapshot = await tx.auctionSnapshot.findFirst({
        where: { source: DataSource.CLASSIC_FOREVER_SCAN, sourceScanId: scanId },
      });
      if (existingSnapshot) {
        return {
          scanId,
          alreadyImported: true,
          snapshotId: existingSnapshot.id,
          realmId,
          realm: realmName,
          auctionCount: existingSnapshot.auctionCount,
          itemCount: existingSnapshot.itemCount,
        };
      }

      const existingRealm = await tx.connectedRealm.findUnique({ where: { id: realmId } });
      if (existingRealm && existingRealm.name !== realmName) {
        throw new BadRequestException('Generated realm key conflicts with a different realm name.');
      }
      await tx.connectedRealm.upsert({
        where: { id: realmId },
        create: { id: realmId, region: Region.US, name: realmName, realmSlugs: [slug] },
        update: { region: Region.US, name: realmName, realmSlugs: [slug] },
      });

      const itemIds = importedItems.map((item) => item.id);
      const existingItems = await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, source: true },
      });
      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const missingItems = [] as Array<{ id: number; name: string }>;
      for (const item of importedItems) {
        const existing = existingById.get(item.id);
        if (!existing) {
          missingItems.push({ id: item.id, name: item.name });
        } else if (
          existing.name !== item.name &&
          existing.source !== DataSource.FOREVER_BETA &&
          existing.source !== DataSource.CLASSIC_FOREVER_SCAN
        ) {
          throw new BadRequestException(
            `Item ${item.id} is already named ${existing.name}; refusing to overwrite it with ${item.name}.`,
          );
        } else if (existing.source === DataSource.CLASSIC_FOREVER_SCAN && existing.name !== item.name) {
          await tx.item.update({ where: { id: item.id }, data: { name: item.name } });
        }
      }
      if (missingItems.length > 0) {
        await tx.item.createMany({
          data: missingItems.map((item) => ({
            ...item,
            isCommodity: false,
            source: DataSource.CLASSIC_FOREVER_SCAN,
          })),
          skipDuplicates: true,
        });
      }

      const snapshot = await tx.auctionSnapshot.create({
        data: {
          region: Region.US,
          scope: AuctionScope.REALM,
          connectedRealmId: realmId,
          source: DataSource.CLASSIC_FOREVER_SCAN,
          sourceScanId: scanId,
          isSample: false,
          fetchedAt,
          auctionCount,
          itemCount: importedItems.length,
        },
      });
      await tx.itemPriceSnapshot.createMany({
        data: importedItems.map((item) => {
          const aggregate = aggregates.get(item.id);
          if (!aggregate) throw new BadRequestException(`Item ${item.id} had no valid price tiers.`);
          return {
            snapshotId: snapshot.id,
            itemId: item.id,
            minUnitPrice: BigInt(aggregate.minUnitPrice),
            marketUnitPrice: BigInt(aggregate.marketUnitPrice),
            medianUnitPrice: BigInt(aggregate.medianUnitPrice),
            totalQuantity: aggregate.totalQuantity,
            listingCount: item.listingCount,
            priceTiers: JSON.parse(
              JSON.stringify(aggregate.priceTiers),
            ) as Prisma.InputJsonValue,
          };
        }),
      });

      return {
        scanId,
        alreadyImported: false,
        snapshotId: snapshot.id,
        realmId,
        realm: realmName,
        auctionCount,
        itemCount: importedItems.length,
      };
    });

    this.cache.invalidatePrefix('crafting:');
    this.cache.invalidatePrefix('pricing:');
    return result;
  }
}