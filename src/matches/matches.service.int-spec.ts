import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
  matchDetails,
  proMatch,
  publicMatch,
} from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { DetailsStatus, MatchSource } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DETAILS_RETRY_DELAY_MS,
  MatchesService,
  MAX_DETAILS_ATTEMPTS,
} from './matches.service.js';

describe('MatchesService', () => {
  let prisma: PrismaService;
  let service: MatchesService;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const gameData = new GameDataService(prisma, fakeOpenDota());
    await gameData.sync();
    service = new MatchesService(prisma, gameData);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const players = (matchId: number) =>
    prisma.matchPlayer.findMany({
      where: { matchId: BigInt(matchId) },
      orderBy: { playerSlot: 'asc' },
    });

  describe('addPublicMatches', () => {
    it('stores the match with the heroes of each team', async () => {
      expect(await service.addPublicMatches([publicMatch()])).toBe(1);

      const match = await prisma.match.findUniqueOrThrow({
        where: { id: 1001n },
      });
      expect(match).toMatchObject({
        source: MatchSource.PUBLIC,
        radiantWin: true,
        patchId: 60,
        avgRankTier: 75,
        detailsStatus: DetailsStatus.PENDING,
      });

      const stored = await players(1001);
      expect(stored.map((p) => p.playerSlot)).toEqual([
        0, 1, 2, 3, 4, 128, 129, 130, 131, 132,
      ]);
      expect(stored[0]).toMatchObject({ heroId: 1, win: true, patchId: 60 });
      expect(stored[5]).toMatchObject({ heroId: 2, win: false });
    });

    it('ignores matches already stored', async () => {
      await service.addPublicMatches([publicMatch()]);

      const added = await service.addPublicMatches([
        publicMatch(),
        publicMatch({ match_id: 1002 }),
      ]);

      expect(added).toBe(1);
      expect(await prisma.matchPlayer.count()).toBe(20);
    });
  });

  describe('addProMatches', () => {
    it('stores the match without players', async () => {
      expect(await service.addProMatches([proMatch()])).toBe(1);

      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 2001n } }),
      ).toMatchObject({ source: MatchSource.PRO, leagueId: 15000 });
      expect(await prisma.matchPlayer.count()).toBe(0);
    });

    it('ignores matches without a result', async () => {
      expect(
        await service.addProMatches([proMatch({ radiant_win: null })]),
      ).toBe(0);
    });
  });

  describe('findPendingDetails', () => {
    it('returns the pro matches first, then the newest', async () => {
      await service.addPublicMatches([
        publicMatch({ match_id: 1, start_time: 1_791_000_000 }),
        publicMatch({ match_id: 2, start_time: 1_791_000_500 }),
      ]);
      await service.addProMatches([proMatch({ match_id: 3 })]);

      const pending = await service.findPendingDetails(10);

      expect(pending.map((m) => m.id)).toEqual([3, 2, 1]);
      expect(pending[0]).toEqual({
        id: 3,
        source: MatchSource.PRO,
        detailsAttempts: 0,
      });
    });

    it('respects the limit and the retry time', async () => {
      await service.addProMatches([
        proMatch({ match_id: 3 }),
        proMatch({ match_id: 4 }),
      ]);
      await prisma.match.update({
        where: { id: 4n },
        data: { detailsAfter: new Date(Date.now() + 60_000) },
      });

      expect(await service.findPendingDetails(10)).toHaveLength(1);
      await service.addProMatches([proMatch({ match_id: 5 })]);
      expect(await service.findPendingDetails(1)).toHaveLength(1);
    });
  });

  describe('saveDetails', () => {
    it('stores the items and the purchase order of a parsed match', async () => {
      await service.addProMatches([proMatch()]);
      const [pending] = await service.findPendingDetails(1);

      await service.saveDetails(pending, matchDetails(2001));

      const stored = await players(2001);
      expect(stored).toHaveLength(10);
      expect(stored[0]).toMatchObject({
        heroId: 1,
        win: false,
        source: MatchSource.PRO,
        accountId: 100n,
        kills: 5,
        items: [1, 145],
        neutralItemId: null,
        // the unknown item is left out
        purchaseItems: [44, 145, 1],
        purchaseTimes: [-89, 600, 1200],
      });
      expect(stored[5].win).toBe(true);
      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 2001n } }),
      ).toMatchObject({
        detailsStatus: DetailsStatus.PARSED,
        detailsAttempts: 1,
      });
    });

    it('replaces the players of a public match', async () => {
      await service.addPublicMatches([publicMatch()]);
      const [pending] = await service.findPendingDetails(1);

      await service.saveDetails(
        pending,
        matchDetails(1001, { parsed: false, radiantWin: true }),
      );

      const stored = await players(1001);
      expect(stored).toHaveLength(10);
      expect(stored[0]).toMatchObject({ items: [1, 145], purchaseItems: [] });
      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 1001n } }),
      ).toMatchObject({ detailsStatus: DetailsStatus.FETCHED });
    });

    it('tries a pro match again later while it is not parsed', async () => {
      await service.addProMatches([proMatch()]);
      const [pending] = await service.findPendingDetails(1);
      const before = Date.now();

      await service.saveDetails(pending, matchDetails(2001, { parsed: false }));

      const match = await prisma.match.findUniqueOrThrow({
        where: { id: 2001n },
      });
      expect(match.detailsStatus).toBe(DetailsStatus.PENDING);
      expect(match.detailsAfter.getTime()).toBeGreaterThanOrEqual(
        before + DETAILS_RETRY_DELAY_MS,
      );
      expect(await players(2001)).toHaveLength(10);
    });

    it('keeps the items of a pro match never parsed', async () => {
      await service.addProMatches([proMatch()]);
      const [pending] = await service.findPendingDetails(1);

      await service.saveDetails(
        { ...pending, detailsAttempts: MAX_DETAILS_ATTEMPTS - 1 },
        matchDetails(2001, { parsed: false }),
      );

      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 2001n } }),
      ).toMatchObject({ detailsStatus: DetailsStatus.FETCHED });
    });
  });

  describe('registerDetailsFailure', () => {
    it('tries again later, then gives up', async () => {
      await service.addProMatches([proMatch()]);
      const [pending] = await service.findPendingDetails(1);

      await service.registerDetailsFailure(pending);
      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 2001n } }),
      ).toMatchObject({
        detailsStatus: DetailsStatus.PENDING,
        detailsAttempts: 1,
      });

      await service.registerDetailsFailure({
        ...pending,
        detailsAttempts: MAX_DETAILS_ATTEMPTS - 1,
      });
      expect(
        await prisma.match.findUniqueOrThrow({ where: { id: 2001n } }),
      ).toMatchObject({ detailsStatus: DetailsStatus.FAILED });
    });
  });

  describe('deleteStartedBefore', () => {
    it('deletes the old matches with their players', async () => {
      await service.addPublicMatches([
        publicMatch({ match_id: 1, start_time: 1_790_000_000 }),
        publicMatch({ match_id: 2, start_time: 1_791_000_000 }),
      ]);

      const deleted = await service.deleteStartedBefore(
        new Date(1_790_500_000 * 1000),
      );

      expect(deleted).toBe(1);
      expect(await prisma.match.count()).toBe(1);
      expect(await prisma.matchPlayer.count()).toBe(10);
    });
  });
});
