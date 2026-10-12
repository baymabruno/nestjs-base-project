import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OpenDotaClient } from '../opendota/opendota.client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PatchInfo {
  id: number;
  name: string;
  releasedAt: Date;
}

/**
 * Heroes, items and patches (OpenDota constants). Kept in the database and,
 * for the lookups done while storing matches, in memory.
 */
@Injectable()
export class GameDataService implements OnModuleInit {
  private readonly logger = new Logger(GameDataService.name);
  private itemIds = new Map<string, number>();
  private hasAbilities = false;
  // newest first
  private patches: PatchInfo[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly openDota: OpenDotaClient,
  ) {}

  async onModuleInit() {
    try {
      await this.load();
    } catch (error) {
      // the database may still be starting; sync() loads the data again
      this.logger.warn(`Game data not loaded: ${(error as Error).message}`);
    }
  }

  /** Whether the heroes, items and patches were loaded */
  get isLoaded(): boolean {
    return this.patches.length > 0 && this.itemIds.size > 0;
  }

  /**
   * Replaces the heroes, items and patches with the current OpenDota data,
   * then the abilities and talent trees (see syncAbilities)
   */
  async sync(): Promise<void> {
    const heroes = Object.values(await this.openDota.getHeroes());
    const items = Object.entries(await this.openDota.getItems());
    const patches = await this.openDota.getPatches();

    await this.prisma.$transaction([
      this.prisma.hero.deleteMany(),
      this.prisma.hero.createMany({
        data: heroes.map((hero) => ({
          id: hero.id,
          name: hero.name,
          localizedName: hero.localized_name,
          primaryAttr: hero.primary_attr,
          roles: hero.roles,
        })),
      }),
      this.prisma.item.deleteMany(),
      this.prisma.item.createMany({
        data: items.map(([name, item]) => ({
          id: item.id,
          name,
          displayName: item.dname ?? null,
          cost: item.cost ?? null,
        })),
        // protects the sync if the API ever repeats an id
        skipDuplicates: true,
      }),
      this.prisma.patch.deleteMany(),
      this.prisma.patch.createMany({
        data: patches.map((patch) => ({
          id: patch.id,
          name: patch.name,
          releasedAt: new Date(patch.date),
        })),
      }),
    ]);

    await this.load();
    this.logger.log(
      `Game data synced: ${heroes.length} heroes, ${items.length} items, current patch ${this.currentPatch().name}`,
    );
    await this.syncAbilities();
  }

  /**
   * Replaces the abilities and the talent trees. They only feed the hero
   * page: a failure is logged, without stopping the match collection, and
   * ensureAbilities tries again.
   */
  async syncAbilities(): Promise<void> {
    try {
      const heroes = await this.prisma.hero.findMany({
        select: { id: true, name: true },
      });
      const abilities = await this.abilities();
      const talents = await this.talents(heroes, abilities);
      await this.prisma.$transaction([
        this.prisma.ability.deleteMany(),
        this.prisma.ability.createMany({
          data: abilities,
          skipDuplicates: true,
        }),
        this.prisma.heroTalent.deleteMany(),
        this.prisma.heroTalent.createMany({
          data: talents,
          skipDuplicates: true,
        }),
      ]);
      this.hasAbilities = abilities.length > 0;
      this.logger.log(
        `Abilities synced: ${abilities.length} abilities, ${talents.length} talents`,
      );
    } catch (error) {
      this.logger.warn(`Abilities not synced: ${(error as Error).message}`);
    }
  }

  /** Syncs the abilities when they are missing (e.g. after an update) */
  async ensureAbilities(): Promise<void> {
    if (!this.hasAbilities) await this.syncAbilities();
  }

  /** Abilities and talents, with the names shown in the game */
  private async abilities() {
    const ids = await this.openDota.getAbilityIds();
    const details = await this.openDota.getAbilities();
    return (
      Object.entries(ids)
        // a few keys are not a single id
        .filter(([id]) => /^\d+$/.test(id))
        .map(([id, name]) => ({
          id: Number(id),
          name,
          displayName: details[name]?.dname ?? null,
          isTalent: name.startsWith('special_bonus'),
        }))
    );
  }

  /** Talent tree of each hero: tier 1 to 4, two options (slots) per tier */
  private async talents(
    heroes: { id: number; name: string }[],
    abilities: { id: number; name: string }[],
  ) {
    const heroAbilities = await this.openDota.getHeroAbilities();
    const abilityIds = new Map(abilities.map((a) => [a.name, a.id]));
    return heroes.flatMap((hero) => {
      const slots = new Map<number, number>();
      return (heroAbilities[hero.name]?.talents ?? []).flatMap((talent) => {
        const abilityId = abilityIds.get(talent.name);
        if (abilityId === undefined) return [];
        const slot = slots.get(talent.level) ?? 0;
        slots.set(talent.level, slot + 1);
        return [{ heroId: hero.id, abilityId, tier: talent.level, slot }];
      });
    });
  }

  /** Item id of a purchase log key (e.g. "blink") */
  itemId(name: string): number | undefined {
    return this.itemIds.get(name);
  }

  /** The patch that was live at the given time */
  patchAt(date: Date): PatchInfo {
    const patch = this.patches.find((p) => p.releasedAt <= date);
    if (!patch) throw new Error(`No patch found for ${date.toISOString()}`);
    return patch;
  }

  /** The latest patch: the current meta */
  currentPatch(): PatchInfo {
    return this.patchAt(new Date());
  }

  private async load() {
    const [items, patches, abilities] = await Promise.all([
      this.prisma.item.findMany({ select: { id: true, name: true } }),
      this.prisma.patch.findMany({ orderBy: { releasedAt: 'desc' } }),
      this.prisma.ability.count(),
    ]);
    this.itemIds = new Map(items.map((item) => [item.name, item.id]));
    this.patches = patches;
    this.hasAbilities = abilities > 0;
  }
}
