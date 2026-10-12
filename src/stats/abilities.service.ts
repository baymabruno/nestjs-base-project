import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchSource } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HeroAbilities, HeroAbilitiesQuery } from './schemas/stats.schemas.js';

const SOURCES = { pro: MatchSource.PRO, public: MatchSource.PUBLIC } as const;
const BUILDS_SHOWN = 5;
// tier 1 to 4 of the talent tree: hero levels 10, 15, 20 and 25
const TIER_LEVELS = [10, 15, 20, 25];

const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Name to show: the STRATZ name has the values filled in; the OpenDota one
 * may still have placeholders ("+{s:bonus_damage} Damage"), shown as "?"
 */
const displayName = (stratz: string | undefined, openDota: string | null) =>
  stratz ?? openDota?.replace(/\{s:[^}]*\}/g, '?') ?? null;
const ratio = (part: number, total: number) =>
  total > 0 ? round(part / total) : 0;

/**
 * Hero page: the most common ability builds (first 10 levels, from the
 * matches with details) and the talent tree with the picks of each option
 * (STRATZ).
 */
@Injectable()
export class AbilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeroAbilities(
    heroId: number,
    { source, position = 0 }: HeroAbilitiesQuery,
  ): Promise<HeroAbilities> {
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException(`Hero ${heroId} not found`);

    const [builds, tree, talentStats] = await Promise.all([
      this.prisma.heroSkillBuildStat.groupBy({
        by: ['build'],
        where: { heroId, ...(source && { source: SOURCES[source] }) },
        _sum: { matches: true, wins: true },
      }),
      this.prisma.heroTalent.findMany({ where: { heroId } }),
      this.prisma.heroTalentStat.findMany({ where: { heroId, position } }),
    ]);

    const buildIds = builds.map((build) => build.build.split(',').map(Number));
    const ids = [
      ...new Set([
        ...buildIds.flat(),
        ...tree.map((talent) => talent.abilityId),
      ]),
    ];
    const [abilities, names] = await Promise.all([
      this.prisma.ability.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, displayName: true, isTalent: true },
      }),
      this.prisma.abilityDisplayName.findMany({
        where: { abilityId: { in: ids } },
      }),
    ]);
    // the STRATZ names have the values of the talents filled in
    const nameById = new Map(names.map((n) => [n.abilityId, n.displayName]));
    const abilityById = new Map(
      abilities.map((a) => [
        a.id,
        { ...a, displayName: displayName(nameById.get(a.id), a.displayName) },
      ]),
    );

    const buildMatches = builds.reduce(
      (sum, build) => sum + (build._sum.matches ?? 0),
      0,
    );
    const statById = new Map(talentStats.map((s) => [s.abilityId, s]));

    return {
      skillBuild: {
        matches: buildMatches,
        builds: builds
          .map((build, index) => {
            const matches = build._sum.matches ?? 0;
            const wins = build._sum.wins ?? 0;
            return {
              abilities: buildIds[index].map(
                (id) => abilityById.get(id) ?? null,
              ),
              matches,
              wins,
              winRate: ratio(wins, matches),
              pickRate: ratio(matches, buildMatches),
            };
          })
          .sort((a, b) => b.matches - a.matches || b.winRate - a.winRate)
          .slice(0, BUILDS_SHOWN),
      },
      talents: {
        available: talentStats.length > 0,
        updatedAt: talentStats[0]?.updatedAt.toISOString() ?? null,
        tiers: [4, 3, 2, 1].flatMap((tier) => {
          const options = tree
            .filter((talent) => talent.tier === tier)
            .sort((a, b) => a.slot - b.slot)
            .flatMap((talent) => {
              const ability = abilityById.get(talent.abilityId);
              if (!ability) return [];
              const stat = statById.get(talent.abilityId);
              return [
                {
                  id: ability.id,
                  name: ability.name,
                  displayName: ability.displayName,
                  matches: stat?.matches ?? 0,
                  wins: stat?.wins ?? 0,
                },
              ];
            });
          if (options.length === 0) return [];
          const picks = options.reduce((sum, o) => sum + o.matches, 0);
          return [
            {
              level: TIER_LEVELS[tier - 1],
              options: options.map((option) => ({
                ...option,
                pickRate: ratio(option.matches, picks),
                winRate: option.matches
                  ? ratio(option.wins, option.matches)
                  : null,
              })),
            },
          ];
        }),
      },
    };
  }
}
