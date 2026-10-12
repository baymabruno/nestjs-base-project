import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeOpenDota } from '../../test/support/opendota-fakes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GameDataService } from './game-data.service.js';

describe('GameDataService', () => {
  let prisma: PrismaService;
  let service: GameDataService;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    service = new GameDataService(prisma, fakeOpenDota());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores the heroes, items and patches', async () => {
    await service.sync();

    expect(await prisma.hero.count()).toBe(2);
    expect(await prisma.item.findUnique({ where: { name: 'blink' } })).toEqual({
      id: 1,
      name: 'blink',
      displayName: 'Blink Dagger',
      cost: 2250,
      isFinal: true,
    });
    const tango = await prisma.item.findUnique({ where: { name: 'tango' } });
    expect(tango?.isFinal).toBe(false);
    expect(await prisma.patch.count()).toBe(2);
    expect(service.isLoaded).toBe(true);
  });

  it('stores the abilities and the talent tree of each hero', async () => {
    await service.sync();

    // the key that is not a single id is left out
    expect(await prisma.ability.count()).toBe(6);
    expect(await prisma.ability.findUnique({ where: { id: 5004 } })).toEqual({
      id: 5004,
      name: 'antimage_blink',
      displayName: 'Blink',
      isTalent: false,
    });
    expect(await prisma.ability.findUnique({ where: { id: 6003 } })).toEqual({
      id: 6003,
      name: 'special_bonus_unique_antimage',
      displayName: null,
      isTalent: true,
    });
    // the talent without an id is left out
    expect(
      await prisma.heroTalent.findMany({
        orderBy: [{ tier: 'asc' }, { slot: 'asc' }],
        select: { abilityId: true, tier: true, slot: true },
      }),
    ).toEqual([
      { abilityId: 6001, tier: 1, slot: 0 },
      { abilityId: 6002, tier: 1, slot: 1 },
      { abilityId: 6003, tier: 2, slot: 0 },
      { abilityId: 6004, tier: 2, slot: 1 },
    ]);
  });

  it('keeps the other data when the abilities fail', async () => {
    const failing = new GameDataService(
      prisma,
      fakeOpenDota({
        getAbilityIds: () => Promise.reject(new Error('offline')),
      }),
    );

    await failing.sync();

    expect(failing.isLoaded).toBe(true);
    expect(await prisma.ability.count()).toBe(0);
  });

  it('syncs the abilities only when they are missing', async () => {
    const getAbilityIds = vi.fn(fakeOpenDota().getAbilityIds);
    const gameData = new GameDataService(
      prisma,
      fakeOpenDota({ getAbilityIds }),
    );

    await gameData.ensureAbilities();
    await gameData.ensureAbilities();

    expect(getAbilityIds).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous data', async () => {
    await service.sync();
    await service.sync();

    expect(await prisma.item.count()).toBe(3);
  });

  it('finds the item id of a purchase key', async () => {
    await service.sync();

    expect(service.itemId('bfury')).toBe(145);
    expect(service.itemId('unknown')).toBeUndefined();
  });

  it('finds the patch of a date', async () => {
    await service.sync();

    expect(service.patchAt(new Date('2026-01-10')).name).toBe('7.40');
    expect(service.patchAt(new Date('2026-04-01')).name).toBe('7.41');
    expect(service.currentPatch().name).toBe('7.41');
    expect(() => service.patchAt(new Date('2020-01-01'))).toThrow(
      'No patch found',
    );
  });

  it('loads the stored data when the module starts', async () => {
    await service.sync();
    const restarted = new GameDataService(prisma, fakeOpenDota());

    await restarted.onModuleInit();

    expect(restarted.isLoaded).toBe(true);
    expect(restarted.currentPatch().name).toBe('7.41');
  });

  it('starts without data when the database is unavailable', async () => {
    const failing = {
      item: { findMany: () => Promise.reject(new Error('offline')) },
      patch: { findMany: () => Promise.reject(new Error('offline')) },
    } as unknown as PrismaService;
    const offline = new GameDataService(failing, fakeOpenDota());

    await offline.onModuleInit();

    expect(offline.isLoaded).toBe(false);
  });
});
