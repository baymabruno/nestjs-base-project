import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ZodError } from 'zod';
import { Env } from '../config/env.validation.js';
import {
  MINUTE_RESERVE,
  OpenDotaClient,
  OpenDotaRateLimitError,
} from './opendota.client.js';

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

  it('reports the rate limit with the requests left today', async () => {
    respond = () => ({
      status: 429,
      headers: { 'x-rate-limit-remaining-day': '2400' },
    });
    const client = createClient();

    await expect(client.getMatch(1)).rejects.toBeInstanceOf(
      OpenDotaRateLimitError,
    );
    // the per-minute limit does not mean the daily quota is over
    expect(client.remainingDailyRequests).toBe(2400);
  });

  it('waits a minute after a rate limit', async () => {
    vi.useFakeTimers();
    const client = createClient();
    respond = () => ({ status: 429 });
    await expect(client.getProMatches()).rejects.toThrow();

    respond = () => ({ data: [] });
    const next = client.getProMatches();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await next;
    expect(requests).toHaveLength(2);
  });

  it('waits for the next minute when few requests are left in it', async () => {
    vi.useFakeTimers();
    const client = createClient();
    respond = () => ({
      data: [],
      headers: { 'x-rate-limit-remaining-minute': String(MINUTE_RESERVE) },
    });
    await client.getProMatches();

    const next = client.getProMatches();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(30_000);
    await next;
    expect(requests).toHaveLength(2);
  });

  it('does not wait while the minute has requests left', async () => {
    const client = createClient();
    respond = () => ({
      data: [],
      headers: { 'x-rate-limit-remaining-minute': '40' },
    });

    await client.getProMatches();
    await client.getProMatches();

    expect(requests).toHaveLength(2);
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
