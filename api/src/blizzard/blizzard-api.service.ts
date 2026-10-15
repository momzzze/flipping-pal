import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../common/cache.service';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig, BlizzardConfig } from '../config/configuration';
import {
  BlizzardApiError,
  BlizzardCredentialsMissingError,
} from './blizzard.errors';
import {
  BlizzardTokenResponse,
  CommodityAuctionsResponse,
  ConditionalResult,
  ConnectedRealmIndexResponse,
  ConnectedRealmResponse,
  ItemResponse,
  MediaResponse,
  ProfessionIndexResponse,
  ProfessionResponse,
  RealmAuctionsResponse,
  RecipeResponse,
  SkillTierResponse,
} from './blizzard.types';
import { RequestThrottler } from './request-throttler';

type Namespace = 'static' | 'dynamic';

interface RequestOptions {
  namespace: Namespace;
  ifModifiedSince?: Date | null;
}

const TOKEN_URL = 'https://oauth.battle.net/token';
const STATIC_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Battle.net OAuth (client credentials) + WoW Game Data API client.
 * Credentials never leave the server. Handles throttling, retries (429/5xx with
 * Retry-After + exponential backoff), token refresh and caching of static data.
 */
@Injectable()
export class BlizzardApiService {
  private readonly logger = new Logger(BlizzardApiService.name);
  private readonly config: BlizzardConfig;
  private readonly throttler: RequestThrottler;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(
    @Inject(APP_CONFIG) appConfig: AppConfig,
    private readonly cache: CacheService,
  ) {
    this.config = appConfig.blizzard;
    this.throttler = new RequestThrottler(
      this.config.maxConcurrency,
      this.config.maxRequestsPerSecond,
    );
  }

  get isConfigured(): boolean {
    return this.config.clientId !== '' && this.config.clientSecret !== '';
  }

  get region(): BlizzardConfig['region'] {
    return this.config.region;
  }

  get targetExpansionName(): string {
    return this.config.targetExpansionName;
  }

  // ---- Game Data endpoints -------------------------------------------------

  getCommodityAuctions(
    ifModifiedSince?: Date | null,
  ): Promise<ConditionalResult<CommodityAuctionsResponse>> {
    return this.request<CommodityAuctionsResponse>(
      '/data/wow/auctions/commodities',
      { namespace: 'dynamic', ifModifiedSince },
    );
  }

  getRealmAuctions(
    connectedRealmId: number,
    ifModifiedSince?: Date | null,
  ): Promise<ConditionalResult<RealmAuctionsResponse>> {
    return this.request<RealmAuctionsResponse>(
      `/data/wow/connected-realm/${connectedRealmId}/auctions`,
      { namespace: 'dynamic', ifModifiedSince },
    );
  }

  async getConnectedRealmIndex(): Promise<ConnectedRealmIndexResponse> {
    return this.getCached<ConnectedRealmIndexResponse>(
      '/data/wow/connected-realm/index',
      'dynamic',
    );
  }

  async getConnectedRealm(id: number): Promise<ConnectedRealmResponse> {
    return this.getCached<ConnectedRealmResponse>(
      `/data/wow/connected-realm/${id}`,
      'dynamic',
    );
  }

  getProfessionIndex(): Promise<ProfessionIndexResponse> {
    return this.getCached('/data/wow/profession/index', 'static');
  }

  getProfession(id: number): Promise<ProfessionResponse> {
    return this.getCached(`/data/wow/profession/${id}`, 'static');
  }

  getProfessionMedia(id: number): Promise<MediaResponse> {
    return this.getCached(`/data/wow/media/profession/${id}`, 'static');
  }

  getSkillTier(
    professionId: number,
    skillTierId: number,
  ): Promise<SkillTierResponse> {
    return this.getCached(
      `/data/wow/profession/${professionId}/skill-tier/${skillTierId}`,
      'static',
    );
  }

  getRecipe(id: number): Promise<RecipeResponse> {
    return this.getCached(`/data/wow/recipe/${id}`, 'static');
  }

  getItem(id: number): Promise<ItemResponse> {
    return this.getCached(`/data/wow/item/${id}`, 'static');
  }

  getItemMedia(id: number): Promise<MediaResponse> {
    return this.getCached(`/data/wow/media/item/${id}`, 'static');
  }

  // ---- Internals -----------------------------------------------------------

  private async getCached<T>(path: string, namespace: Namespace): Promise<T> {
    const ttl = namespace === 'static' ? STATIC_CACHE_TTL_MS : 60 * 60 * 1000;
    return this.cache.wrap(`blizzard:${namespace}:${path}`, ttl, async () => {
      const result = await this.request<T>(path, { namespace });
      if (result.data === null) {
        throw new BlizzardApiError('Unexpected 304 response', 304, path);
      }
      return result.data;
    });
  }

  private assertConfigured(): void {
    if (!this.isConfigured) throw new BlizzardCredentialsMissingError();
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    this.assertConfigured();
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }
    if (!this.tokenPromise) {
      this.tokenPromise = this.fetchToken().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  private async fetchToken(): Promise<string> {
    const basic = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) {
      throw new BlizzardApiError(
        `Battle.net OAuth token request failed (${response.status}). Check BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET.`,
        response.status,
        TOKEN_URL,
      );
    }
    const body = (await response.json()) as BlizzardTokenResponse;
    // Refresh one minute before actual expiry.
    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + Math.max(0, body.expires_in - 60) * 1000,
    };
    this.logger.log('Obtained Battle.net access token');
    return body.access_token;
  }

  private buildUrl(path: string, namespace: Namespace): string {
    const url = new URL(
      `https://${this.config.region}.api.blizzard.com${path}`,
    );
    url.searchParams.set('namespace', `${namespace}-${this.config.region}`);
    url.searchParams.set('locale', this.config.locale);
    return url.toString();
  }

  private async request<T>(
    path: string,
    options: RequestOptions,
  ): Promise<ConditionalResult<T>> {
    this.assertConfigured();
    const url = this.buildUrl(path, options.namespace);
    let refreshedToken = false;

    for (let attempt = 0; ; attempt += 1) {
      const token = await this.getAccessToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      if (options.ifModifiedSince) {
        headers['If-Modified-Since'] = options.ifModifiedSince.toUTCString();
      }

      let response: Response;
      try {
        response = await this.throttler.schedule(() => fetch(url, { headers }));
      } catch (error) {
        if (attempt < this.config.maxRetries) {
          await this.backoff(attempt, null, path, 'network error');
          continue;
        }
        throw new BlizzardApiError(
          `Network error calling Blizzard API: ${(error as Error).message}`,
          0,
          path,
        );
      }

      const lastModifiedHeader = response.headers.get('last-modified');
      const lastModified = lastModifiedHeader
        ? new Date(lastModifiedHeader)
        : null;

      if (response.status === 304) {
        return {
          data: null,
          lastModified: lastModified ?? options.ifModifiedSince ?? null,
        };
      }
      if (response.ok) {
        return { data: (await response.json()) as T, lastModified };
      }
      if (response.status === 401 && !refreshedToken) {
        refreshedToken = true;
        await this.getAccessToken(true);
        continue;
      }
      if (
        RETRYABLE_STATUS.has(response.status) &&
        attempt < this.config.maxRetries
      ) {
        await this.backoff(
          attempt,
          response.headers.get('retry-after'),
          path,
          `HTTP ${response.status}`,
        );
        continue;
      }
      throw new BlizzardApiError(
        response.status === 429
          ? 'Blizzard API rate limit exceeded. Please retry later.'
          : `Blizzard API request failed with HTTP ${response.status}`,
        response.status,
        path,
      );
    }
  }

  private async backoff(
    attempt: number,
    retryAfter: string | null,
    path: string,
    reason: string,
  ): Promise<void> {
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const delay = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
    this.logger.warn(
      `${reason} for ${path}; retrying in ${delay}ms (attempt ${attempt + 1})`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
