import { CacheService } from '../common/cache.service';
import { loadConfiguration } from '../config/configuration';
import { BlizzardApiService } from './blizzard-api.service';
import {
  BlizzardApiError,
  BlizzardCredentialsMissingError,
} from './blizzard.errors';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function createService(env: Record<string, string> = {}): BlizzardApiService {
  const config = loadConfiguration({
    BLIZZARD_CLIENT_ID: 'client',
    BLIZZARD_CLIENT_SECRET: 'secret',
    BLIZZARD_MAX_RETRIES: '2',
    ...env,
  });
  return new BlizzardApiService(config, new CacheService());
}

describe('BlizzardApiService', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const tokenResponse = () =>
    jsonResponse(200, {
      access_token: 'abc',
      token_type: 'bearer',
      expires_in: 86399,
    });

  it('throws a descriptive error when credentials are missing', async () => {
    const service = createService({
      BLIZZARD_CLIENT_ID: '',
      BLIZZARD_CLIENT_SECRET: '',
    });
    expect(service.isConfigured).toBe(false);
    await expect(service.getItem(1)).rejects.toBeInstanceOf(
      BlizzardCredentialsMissingError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('obtains a token once and calls the regional game data endpoint with namespace and locale', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { id: 1, name: 'Item' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 2, name: 'Other' }));
    const service = createService();
    await service.getItem(1);
    await service.getItem(2);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://oauth.battle.net/token');
    expect(tokenInit?.method).toBe('POST');
    const itemUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(itemUrl.host).toBe('eu.api.blizzard.com');
    expect(itemUrl.pathname).toBe('/data/wow/item/1');
    expect(itemUrl.searchParams.get('namespace')).toBe('static-eu');
    expect(itemUrl.searchParams.get('locale')).toBe('en_GB');
  });

  it('caches static responses', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { id: 1, name: 'Item' }));
    const service = createService();
    await service.getItem(1);
    await service.getItem(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 honoring Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(200, { auctions: [] }));
    const service = createService();
    const result = await service.getCommodityAuctions();
    expect(result.data).toEqual({ auctions: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after max retries with a rate limit error', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValue(jsonResponse(429, {}, { 'retry-after': '0' }));
    const service = createService();
    await expect(service.getCommodityAuctions()).rejects.toMatchObject({
      status: 429,
    });
    await expect(service.getCommodityAuctions()).rejects.toBeInstanceOf(
      BlizzardApiError,
    );
  });

  it('returns null data on 304 Not Modified and sends If-Modified-Since', async () => {
    const since = new Date('2026-01-01T10:00:00Z');
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(304, null));
    const service = createService();
    const result = await service.getCommodityAuctions(since);
    expect(result.data).toBeNull();
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<
      string,
      string
    >;
    expect(headers['If-Modified-Since']).toBe(since.toUTCString());
  });

  it('refreshes the token once on 401', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { auctions: [] }));
    const service = createService();
    await expect(service.getCommodityAuctions()).resolves.toMatchObject({
      data: { auctions: [] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
