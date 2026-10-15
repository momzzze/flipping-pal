import { Region } from '@prisma/client';
import { BlizzardRegion } from '../config/configuration';

export function toPrismaRegion(region: BlizzardRegion): Region {
  return region.toUpperCase() as Region;
}
