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

  /** Replaces the heroes, items and patches with the current OpenDota data */
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
    const [items, patches] = await Promise.all([
      this.prisma.item.findMany({ select: { id: true, name: true } }),
      this.prisma.patch.findMany({ orderBy: { releasedAt: 'desc' } }),
    ]);
    this.itemIds = new Map(items.map((item) => [item.name, item.id]));
    this.patches = patches;
  }
}
