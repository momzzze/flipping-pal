export type BlizzardRegion = 'eu' | 'us' | 'kr' | 'tw';

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  ahCutRate: number;
  auctionRefreshIntervalMinutes: number;
  blizzard: BlizzardConfig;
}

export interface BlizzardConfig {
  clientId: string;
  clientSecret: string;
  region: BlizzardRegion;
  locale: string;
  targetExpansionName: string;
  maxConcurrency: number;
  maxRequestsPerSecond: number;
  maxRetries: number;
}

const REGIONS: readonly BlizzardRegion[] = ['eu', 'us', 'kr', 'tw'];

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRegion(value: string | undefined): BlizzardRegion {
  const lower = (value ?? 'eu').toLowerCase();
  return (REGIONS as readonly string[]).includes(lower)
    ? (lower as BlizzardRegion)
    : 'eu';
}

export function loadConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  return {
    port: toNumber(env.PORT, 3000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    ahCutRate: toNumber(env.AH_CUT_RATE, 0.05),
    auctionRefreshIntervalMinutes: toNumber(
      env.AUCTION_REFRESH_INTERVAL_MINUTES,
      0,
    ),
    blizzard: {
      clientId: env.BLIZZARD_CLIENT_ID?.trim() ?? '',
      clientSecret: env.BLIZZARD_CLIENT_SECRET?.trim() ?? '',
      region: toRegion(env.BLIZZARD_REGION ?? 'us'),
      locale: env.BLIZZARD_LOCALE?.trim() || 'en_GB',
      targetExpansionName: env.TARGET_EXPANSION_NAME?.trim() || 'Forever',
      maxConcurrency: Math.max(1, toNumber(env.BLIZZARD_MAX_CONCURRENCY, 8)),
      maxRequestsPerSecond: Math.max(
        1,
        toNumber(env.BLIZZARD_MAX_REQUESTS_PER_SECOND, 50),
      ),
      maxRetries: Math.max(0, toNumber(env.BLIZZARD_MAX_RETRIES, 4)),
    },
  };
}

export const APP_CONFIG = 'APP_CONFIG';
