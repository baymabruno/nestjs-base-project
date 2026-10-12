import { NotFoundException } from '@nestjs/common';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
  fakeStratz,
  matchDetails,
  proMatch,
} from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TalentStatsService } from '../stratz/talent-stats.service.js';
import { AbilitiesService } from './abilities.service.js';
import { StatsService } from './stats.service.js';

// first 10 levels of the fake matches: abilities 5003/5004, talent at 10
const BUILD = [5003, 5004, 5003, 5004, 5003, 5004, 5003, 5004, 5003, 6001];

describe('AbilitiesService', () => {
  let prisma: PrismaService;
  let service: AbilitiesService;
  let matches: MatchesService;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new AbilitiesService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const gameData = new GameDataService(prisma, fakeOpenDota());
    await gameData.sync();
    matches = new MatchesService(prisma, gameData);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function addMatch(id: number, radiantWin: boolean, build = BUILD) {
    await matches.addProMatches([proMatch({ match_id: id })]);
    const [pending] = await matches.findPendingDetails(1);
    const details = matchDetails(id, { radiantWin });
    for (const player of details.players) player.ability_upgrades_arr = build;
    await matches.saveDetails(pending, details);
  }

  it('is empty without matches and talent statistics', async () => {
    const result = await service.getHeroAbilities(1, {});

    expect(result.skillBuild).toEqual({ matches: 0, builds: [] });
    expect(result.talents).toMatchObject({ available: false, updatedAt: null });
    // the tree comes from the game data, without picks
    expect(result.talents.tiers.map((tier) => tier.level)).toEqual([15, 10]);
    expect(result.talents.tiers[1].options[0]).toMatchObject({
      id: 6001,
      matches: 0,
      pickRate: 0,
      winRate: null,
    });
  });

  it('returns the most common builds of the first 10 levels', async () => {
    // hero 1 plays on radiant
    await addMatch(1, true);
    await addMatch(2, false);
    await addMatch(3, true, [...BUILD.slice(0, 9), 5004]);
    // fewer than 10 levels: left out
    await addMatch(4, true, BUILD.slice(0, 6));
    await new StatsService(prisma).refresh(60, new Date(0));

    const { skillBuild } = await service.getHeroAbilities(1, {});

    expect(skillBuild.matches).toBe(3);
    expect(skillBuild.builds).toEqual([
      expect.objectContaining({
        matches: 2,
        wins: 1,
        winRate: 0.5,
        pickRate: 0.6667,
      }),
      expect.objectContaining({ matches: 1, wins: 1, winRate: 1 }),
    ]);
    expect(skillBuild.builds[0].abilities[0]).toEqual({
      id: 5003,
      name: 'antimage_mana_break',
      displayName: 'Mana Break',
      isTalent: false,
    });
    expect(skillBuild.builds[0].abilities[9]).toMatchObject({
      id: 6001,
      isTalent: true,
    });
  });

  it('filters the builds by source', async () => {
    await addMatch(1, true);
    await new StatsService(prisma).refresh(60, new Date(0));

    const { skillBuild } = await service.getHeroAbilities(1, {
      source: 'public',
    });

    expect(skillBuild).toEqual({ matches: 0, builds: [] });
  });

  it('returns the talent tree with the picks of each option', async () => {
    await new TalentStatsService(
      prisma,
      fakeStratz([], true, [
        { heroId: 1, position: 0, abilityId: 6001, matches: 300, wins: 150 },
        { heroId: 1, position: 0, abilityId: 6002, matches: 100, wins: 60 },
        { heroId: 1, position: 0, abilityId: 6003, matches: 50, wins: 30 },
      ]),
    ).sync(new Date('2026-10-12T05:00:00Z'));

    const { talents } = await service.getHeroAbilities(1, {});

    expect(talents.available).toBe(true);
    expect(talents.updatedAt).toBe('2026-10-12T05:00:00.000Z');
    const [level15, level10] = talents.tiers;
    expect(level10).toEqual({
      level: 10,
      options: [
        expect.objectContaining({
          id: 6001,
          // the STRATZ name, with the value filled in
          displayName: '+20 Attack Speed',
          matches: 300,
          pickRate: 0.75,
          winRate: 0.5,
        }),
        expect.objectContaining({
          id: 6002,
          displayName: '+10 Agility',
          pickRate: 0.25,
          winRate: 0.6,
        }),
      ],
    });
    expect(level15.options.map((option) => option.matches)).toEqual([50, 0]);
    expect(level15.options[0].displayName).toBe('+15% Mana Break Burn');
  });

  it('shows the placeholders of an OpenDota name as "?"', async () => {
    await prisma.ability.update({
      where: { id: 6004 },
      data: { displayName: '+{s:bonus_health} Health' },
    });

    const { talents } = await service.getHeroAbilities(1, {});

    expect(talents.tiers[0].options[1].displayName).toBe('+? Health');
  });

  it('returns the talents of a position', async () => {
    await new TalentStatsService(
      prisma,
      fakeStratz([], true, [
        { heroId: 1, position: 0, abilityId: 6001, matches: 300, wins: 150 },
        { heroId: 1, position: 1, abilityId: 6001, matches: 40, wins: 30 },
      ]),
    ).sync(new Date('2026-10-12T05:00:00Z'));

    const { talents } = await service.getHeroAbilities(1, { position: 1 });

    expect(talents.tiers[1].options[0]).toMatchObject({
      id: 6001,
      matches: 40,
      winRate: 0.75,
    });
  });

  it('rejects an unknown hero', async () => {
    await expect(service.getHeroAbilities(999, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
