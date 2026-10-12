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

  describe('getHeroTalents', () => {
    it('requests the heroes in batches of 50', async () => {
      const queries: string[] = [];
      const instance = axios.create({
        adapter: async (config) => {
          const { query } = JSON.parse(config.data as string);
          queries.push(query);
          const aliases = [...query.matchAll(/(h\d+p\d+): talent/g)].map(
            (match) => match[1],
          );
          const heroStats = Object.fromEntries(
            aliases.map((alias) => [
              alias,
              // an unknown hero comes as null
              alias === 'h24p0'
                ? null
                : [{ abilityId: 6000, matchCount: 10, winCount: 4 }],
            ]),
          );
          return {
            data: { data: { heroStats } },
            status: 200,
            statusText: '',
            headers: {},
            config,
          };
        },
      });
      const client = new StratzClient(
        new HttpService(instance),
        new ConfigService({
          STRATZ_API_URL: 'https://stratz.test/graphql',
          STRATZ_API_TOKEN: 'token',
        }) as ConfigService<Env, true>,
      );

      const heroIds = Array.from({ length: 60 }, (_, index) => index + 1);
      const rows = await client.getHeroTalents(heroIds);

      expect(queries).toHaveLength(2);
      expect(queries[0]).toContain(
        'h1p0: talent(heroId: 1, bracketBasicIds: [DIVINE_IMMORTAL])',
      );
      expect(rows).toHaveLength(59);
      expect(rows[0]).toEqual({
        heroId: 1,
        position: 0,
        abilityId: 6000,
        matches: 10,
        wins: 4,
      });
    });
  });

  describe('getAbilityNames', () => {
    it('returns the English names with the values filled in', async () => {
      answer = {
        data: {
          constants: {
            abilities: [
              { id: 966, language: { displayName: '+200 Mana Void Radius' } },
              { id: 5003, language: { displayName: null } },
              { id: 5004, language: null },
            ],
          },
        },
      };

      const names = await createClient('token').getAbilityNames();

      expect(JSON.parse(request?.data as string).query).toContain(
        'abilities(language: ENGLISH)',
      );
      expect([...names]).toEqual([[966, '+200 Mana Void Radius']]);
    });

    it('reports the GraphQL errors', async () => {
      answer = { errors: [{ message: 'No access' }] };

      await expect(createClient('token').getAbilityNames()).rejects.toThrow(
        'No access',
      );
    });
  });

  describe('items by role', () => {
    it('returns the minute of the first purchase per position', async () => {
      answer = {
        data: {
          heroStats: {
            h1p1: [{ itemId: 145, time: 14, matchCount: 300, winCount: 160 }],
            h1p2: null,
          },
        },
      };

      const rows = await createClient('token').getRoleItemTimings([1]);

      const { query } = JSON.parse(request?.data as string);
      expect(query).toContain(
        'h1p5: itemFullPurchase(heroId: 1, bracketBasicIds: [DIVINE_IMMORTAL], positionIds: [POSITION_5], matchLimit: 25)',
      );
      expect(rows).toEqual([
        {
          heroId: 1,
          position: 1,
          itemId: 145,
          minute: 14,
          matches: 300,
          wins: 160,
        },
      ]);
    });

    it('keeps only the first starting item bought, not given', async () => {
      answer = {
        data: {
          heroStats: {
            h1p4: [
              {
                itemId: 44,
                instance: 0,
                wasGiven: false,
                matchCount: 900,
                winCount: 470,
              },
              {
                itemId: 44,
                instance: 1,
                wasGiven: false,
                matchCount: 300,
                winCount: 150,
              },
              {
                itemId: 218,
                instance: 0,
                wasGiven: true,
                matchCount: 200,
                winCount: 90,
              },
            ],
          },
        },
      };

      const rows = await createClient('token').getRoleStartingItems([1]);

      expect(rows).toEqual([
        { heroId: 1, position: 4, itemId: 44, matches: 900, wins: 470 },
      ]);
    });
  });
});
