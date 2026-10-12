import { OpenDotaClient } from '../../src/opendota/opendota.client.js';
import {
  MatchDetails,
  ProMatch,
  PublicMatch,
} from '../../src/opendota/opendota.schemas.js';

// unix time of the tests: inside patch 7.41
export const NOW = 1_791_000_000;

export const patches = [
  { id: 59, name: '7.40', date: '2025-12-16T00:50:40.281Z' },
  { id: 60, name: '7.41', date: '2026-03-24T00:50:59.580Z' },
];

/** OpenDota client answering with fixed game data */
export const fakeOpenDota = (overrides: Partial<OpenDotaClient> = {}) =>
  ({
    getHeroes: async () => ({
      '1': {
        id: 1,
        name: 'npc_dota_hero_antimage',
        localized_name: 'Anti-Mage',
        primary_attr: 'agi',
        roles: ['Carry'],
      },
      '2': {
        id: 2,
        name: 'npc_dota_hero_axe',
        localized_name: 'Axe',
        primary_attr: 'str',
        roles: ['Initiator'],
      },
    }),
    getItems: async () => ({
      blink: { id: 1, dname: 'Blink Dagger', cost: 2250 },
      tango: { id: 44, dname: 'Tango', cost: 90 },
      bfury: { id: 145, dname: 'Battle Fury', cost: 4100 },
    }),
    getPatches: async () => patches,
    ...overrides,
  }) as unknown as OpenDotaClient;

export const publicMatch = (overrides: Partial<PublicMatch> = {}) => ({
  match_id: 1001,
  start_time: NOW,
  duration: 2400,
  radiant_win: true,
  lobby_type: 7,
  game_mode: 22,
  avg_rank_tier: 75,
  radiant_team: [1, 3, 4, 5, 6],
  dire_team: [2, 7, 8, 9, 10],
  ...overrides,
});

export const proMatch = (overrides: Partial<ProMatch> = {}): ProMatch => ({
  match_id: 2001,
  start_time: NOW,
  duration: 2100,
  radiant_win: false,
  leagueid: 15000,
  league_name: 'Test League',
  ...overrides,
});

const player = (slot: number, heroId: number) => ({
  player_slot: slot,
  account_id: 100 + slot,
  hero_id: heroId,
  isRadiant: slot < 128,
  kills: 5,
  deaths: 2,
  assists: 10,
  item_0: 1,
  item_1: 145,
  item_2: 0,
  item_3: 0,
  item_4: 0,
  item_5: 0,
  item_neutral: 0,
});

/** Match details; parsed adds the purchase order */
export const matchDetails = (
  matchId: number,
  { parsed = true, radiantWin = false } = {},
): MatchDetails => ({
  match_id: matchId,
  start_time: NOW,
  duration: 2100,
  radiant_win: radiantWin,
  game_mode: 2,
  lobby_type: 1,
  leagueid: 15000,
  version: parsed ? 22 : null,
  players: [0, 1, 2, 3, 4, 128, 129, 130, 131, 132].map((slot, index) => ({
    ...player(slot, index + 1),
    purchase_log: parsed
      ? [
          { time: -89, key: 'tango' },
          { time: 600, key: 'bfury' },
          { time: 900, key: 'unknown_item' },
          { time: 1200, key: 'blink' },
        ]
      : null,
  })),
});
