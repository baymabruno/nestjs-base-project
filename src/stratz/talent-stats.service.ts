import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { POSITIONS, StratzClient } from './stratz.client.js';

/**
 * Talent picks of each hero (STRATZ), stored in hero_talent_stats, and the
 * ability names with the values filled in (ability_display_names)
 */
@Injectable()
export class TalentStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stratz: StratzClient,
  ) {}

  /**
   * Replaces the talent statistics with the latest STRATZ week, for the
   * heroes in the database in every position and in each one, and the
   * ability names. Returns how many talent rows were stored.
   */
  async sync(now = new Date()): Promise<number> {
    const heroes = await this.prisma.hero.findMany({ select: { id: true } });
    if (heroes.length === 0) return 0;
    // every position (0) and each one
    const rows = await this.stratz.getHeroTalents(
      heroes.map((hero) => hero.id),
      [0, ...POSITIONS],
    );
    const names = await this.stratz.getAbilityNames();

    const [, { count }] = await this.prisma.$transaction([
      this.prisma.heroTalentStat.deleteMany(),
      this.prisma.heroTalentStat.createMany({
        data: rows.map((row) => ({ ...row, updatedAt: now })),
        // protects the sync if STRATZ ever repeats a talent of a hero
        skipDuplicates: true,
      }),
      this.prisma.abilityDisplayName.deleteMany(),
      this.prisma.abilityDisplayName.createMany({
        data: [...names].map(([abilityId, displayName]) => ({
          abilityId,
          displayName,
        })),
      }),
    ]);
    return count;
  }
}
