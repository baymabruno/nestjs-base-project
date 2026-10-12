import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios, { InternalAxiosRequestConfig } from 'axios';
import { Env } from '../config/env.validation.js';
import { StratzClient, StratzError } from './stratz.client.js';

const DAY = 1791590400; // 2026-10-10

describe('StratzClient', () => {
  let request: InternalAxiosRequestConfig | undefined;
  let answer: unknown;

  const createClient = (token?: string) => {
    const instance = axios.create({
      adapter: async (config) => {
        request = config;
        return {
          data: answer,
          status: 200,
          statusText: '',
          headers: {},
          config,
        };
      },
    });
    return new StratzClient(
      new HttpService(instance),
      new ConfigService({
        STRATZ_API_URL: 'https://stratz.test/graphql',
        STRATZ_API_TOKEN: token,
      }) as ConfigService<Env, true>,
    );
  };

  beforeEach(() => {
    request = undefined;
    answer = {
      data: {
        heroStats: {
          p1_DIVINE: [{ day: DAY, heroId: 8, winCount: 60, matchCount: 100 }],
          p5_IMMORTAL: [{ day: DAY, heroId: 31, winCount: 5, matchCount: 9 }],
        },
      },
    };
  });

  it('is configured only with a token', () => {
    expect(createClient().isConfigured).toBe(false);
    expect(createClient('token').isConfigured).toBe(true);
  });

  it('requests every position and rank in one query', async () => {
    await createClient('token').getHeroPositionDays(30);

    expect(request?.url).toBe('https://stratz.test/graphql');
    expect(request?.headers.Authorization).toBe('Bearer token');
    expect(request?.headers['User-Agent']).toBe('STRATZ_API');
    const { query } = JSON.parse(request?.data as string);
    expect(query.match(/winDay\(/g)).toHaveLength(10);
    expect(query).toContain(
      'p3_IMMORTAL: winDay(take: 30, positionIds: [POSITION_3], bracketIds: [IMMORTAL], gameModeIds: [ALL_PICK_RANKED], groupBy: HERO_ID)',
    );
  });

  it('returns the rows with the position and the rank', async () => {
    const rows = await createClient('token').getHeroPositionDays(30);

    expect(rows).toEqual([
      {
        day: new Date('2026-10-10T00:00:00Z'),
        position: 1,
        rankBracket: 7,
        heroId: 8,
        matches: 100,
        wins: 60,
      },
      {
        day: new Date('2026-10-10T00:00:00Z'),
        position: 5,
        rankBracket: 8,
        heroId: 31,
        matches: 9,
        wins: 5,
      },
    ]);
  });

  it('reports the GraphQL errors', async () => {
    answer = { data: null, errors: [{ message: 'Bad field' }] };

    await expect(createClient('token').getHeroPositionDays(30)).rejects.toThrow(
      new StratzError('Bad field'),
    );
  });

  it('rejects an empty answer', async () => {
    answer = {};

    await expect(createClient('token').getHeroPositionDays(30)).rejects.toThrow(
      'Empty answer',
    );
  });
});
