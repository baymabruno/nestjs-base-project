import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ZodError } from 'zod';
import { Env } from '../config/env.validation.js';
import { OpenDotaClient, OpenDotaRateLimitError } from './opendota.client.js';

interface FakeResponse {
  status?: number;
  data?: unknown;
  headers?: Record<string, string>;
}

const publicMatch = {
  match_id: 2,
  start_time: 1700000000,
  duration: 2400,
  radiant_win: true,
  lobby_type: 7,
  game_mode: 22,
  avg_rank_tier: 75,
  radiant_team: [1, 2, 3, 4, 5],
  dire_team: [6, 7, 8, 9, 10],
};

describe('OpenDotaClient', () => {
  let requests: InternalAxiosRequestConfig[];
  let respond: (config: InternalAxiosRequestConfig) => FakeResponse;

  const createClient = (env: Partial<Env> = {}) => {
    const instance = axios.create({
      baseURL: 'https://api.test',
      // answers with respond() instead of calling the API
      adapter: async (config) => {
        requests.push(config);
        const { status = 200, data = [], headers = {} } = respond(config);
        const response = { data, status, statusText: '', headers, config };
        if (status >= 400) {
          throw new AxiosError('error', undefined, config, null, response);
        }
        return response;
      },
    });
    const config = new ConfigService({
      OPENDOTA_REQUEST_INTERVAL_MS: 0,
      ...env,
    }) as ConfigService<Env, true>;
    return new OpenDotaClient(new HttpService(instance), config);
  };

  beforeEach(() => {
    requests = [];
    respond = () => ({ data: [publicMatch] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gets the public matches with the filters', async () => {
    const matches = await createClient().getPublicMatches({
      minRank: 70,
      lessThanMatchId: 10,
    });

    expect(matches).toEqual([publicMatch]);
    expect(requests[0].url).toBe('/publicMatches');
    expect(requests[0].params).toMatchObject({
      min_rank: 70,
      less_than_match_id: 10,
    });
  });

  it('removes the fields the application does not use', async () => {
    respond = () => ({ data: [{ ...publicMatch, cluster: 187 }] });

    const [match] = await createClient().getPublicMatches();

    expect(match).not.toHaveProperty('cluster');
  });

  it('sends the API key when configured', async () => {
    await createClient({ OPENDOTA_API_KEY: 'secret' }).getPublicMatches();

    expect(requests[0].params.api_key).toBe('secret');
  });

  it('rejects a response in an unexpected format', async () => {
    respond = () => ({ data: [{ match_id: 'abc' }] });

    await expect(createClient().getPublicMatches()).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('tracks the requests left today', async () => {
    const client = createClient();
    expect(client.remainingDailyRequests).toBeNull();

    respond = () => ({
      data: [publicMatch],
      headers: { 'x-rate-limit-remaining-day': '2500' },
    });
    await client.getPublicMatches();

    expect(client.remainingDailyRequests).toBe(2500);
  });

  it('reports the rate limit', async () => {
    respond = () => ({ status: 429 });
    const client = createClient();

    await expect(client.getMatch(1)).rejects.toBeInstanceOf(
      OpenDotaRateLimitError,
    );
    expect(client.remainingDailyRequests).toBe(0);
  });

  it('rethrows other errors', async () => {
    respond = () => ({ status: 500 });

    await expect(createClient().getHeroes()).rejects.toBeInstanceOf(AxiosError);
  });

  it('spaces the requests by the configured interval', async () => {
    vi.useFakeTimers();
    const client = createClient({ OPENDOTA_REQUEST_INTERVAL_MS: 1000 });
    respond = () => ({ data: [] });

    const first = client.getProMatches();
    const second = client.getProMatches();
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);
    expect(requests).toHaveLength(2);
  });

  it('keeps going after a failed request', async () => {
    respond = () => ({ status: 500 });
    const client = createClient();
    await expect(client.getItems()).rejects.toThrow();

    respond = () => ({
      data: [{ id: 1, name: '7.41', date: '2026-03-24T00:50:59.580Z' }],
    });

    await expect(client.getPatches()).resolves.toHaveLength(1);
  });
});
