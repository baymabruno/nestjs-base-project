import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { wilsonLowerBound } from './confidence.js';
import { scoreHeroes } from './score.js';
import {
  HeroRoles,
  HeroRolesQuery,
  Roles,
  RolesQuery,
} from './schemas/stats.schemas.js';

const RANK_BRACKETS = { divine: 7, immortal: 8 } as const;

const round = (value: number) => Math.round(value * 10000) / 10000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const POSITIONS = [1, 2, 3, 4, 5] as const;
// matches a hero needs in a role to be scored (as in the meta page)
export const MIN_ROLE_MATCHES = 100;
const totals = (matches: number, wins: number) => ({
  matches,
  wins,
  winRate: matches > 0 ? round(wins / matches) : null,
});

/**
 * Heroes by role (position 1 to 5) from the STRATZ data of the latest day
 * (STRATZ has whole days only), with a score and a tier (see score.ts). A
 * day before the current patch is not used, so two patches are never mixed.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Latest day with data, or null when there is none of the current patch */
  private async latestDay(now: Date): Promise<Date | null> {
    const [latest, patch] = await Promise.all([
      this.prisma.heroPositionDailyStat.findFirst({
        orderBy: { day: 'desc' },
        select: { day: true },
      }),
      this.prisma.patch.findFirst({
        where: { releasedAt: { lte: now } },
        orderBy: { releasedAt: 'desc' },
      }),
    ]);
    if (!latest) return null;
    if (patch && isoDay(latest.day) < isoDay(patch.releasedAt)) return null;
    return latest.day;
  }

  async getHeroes(
    { position, bracket, minMatches }: RolesQuery,
    now = new Date(),
  ): Promise<Roles> {
    const day = await this.latestDay(now);
    if (!day) return { available: false, day: null, matches: 0, heroes: [] };

    const where: Prisma.HeroPositionDailyStatWhereInput = {
      day,
      ...(position && { position }),
      ...(bracket && { rankBracket: RANK_BRACKETS[bracket] }),
    };
    const [rows, heroes] = await Promise.all([
      this.prisma.heroPositionDailyStat.groupBy({
        by: ['heroId'],
        where,
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany({
        select: { id: true, name: true, localizedName: true },
      }),
    ]);

    // each match has 2 players in a position, or 10 in all of them
    const playersPerMatch = position ? 2 : 10;
    const matches =
      rows.reduce((sum, row) => sum + (row._sum.matches ?? 0), 0) /
      playersPerMatch;
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));

    const stats = rows.flatMap((row) => {
      const hero = heroById.get(row.heroId);
      const heroMatches = row._sum.matches ?? 0;
      const wins = row._sum.wins ?? 0;
      if (!hero || heroMatches < minMatches) return [];
      return [
        {
          ...hero,
          matches: heroMatches,
          wins,
          winRate: round(wins / heroMatches),
          winRateLow: round(wilsonLowerBound(wins, heroMatches)),
          pickRate: round(heroMatches / matches),
        },
      ];
    });

    return {
      available: true,
      day: isoDay(day),
      matches: Math.round(matches),
      heroes: scoreHeroes(stats),
    };
  }

  /**
   * A hero in each role: matches and win rate in every position, the share of
   * the matches of the hero and the score in the role (the same ranking of
   * getHeroes, among the heroes with MIN_ROLE_MATCHES matches)
   */
  async getHeroRoles(
    heroId: number,
    { bracket }: HeroRolesQuery,
    now = new Date(),
  ): Promise<HeroRoles> {
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException(`Hero ${heroId} not found`);

    const rankings = await Promise.all(
      POSITIONS.map((position) =>
        this.getHeroes(
          { position, bracket, minMatches: MIN_ROLE_MATCHES },
          now,
        ),
      ),
    );
    const [{ available, day }] = rankings;
    if (!available || !day) {
      return {
        available: false,
        day: null,
        all: totals(0, 0),
        positions: [],
        mostPlayed: null,
      };
    }

    const rows = await this.prisma.heroPositionDailyStat.groupBy({
      by: ['position'],
      where: {
        heroId,
        day: new Date(day),
        ...(bracket && { rankBracket: RANK_BRACKETS[bracket] }),
      },
      _sum: { matches: true, wins: true },
    });
    const byPosition = new Map(rows.map((row) => [row.position, row._sum]));
    const all = rows.reduce(
      (sum, row) => ({
        matches: sum.matches + (row._sum.matches ?? 0),
        wins: sum.wins + (row._sum.wins ?? 0),
      }),
      { matches: 0, wins: 0 },
    );

    const positions = POSITIONS.map((position, index) => {
      const row = byPosition.get(position);
      const ranking = rankings[index];
      const place = ranking.heroes.findIndex((hero) => hero.id === heroId);
      const ranked = ranking.heroes[place];
      const matches = row?.matches ?? 0;
      const wins = row?.wins ?? 0;
      return {
        position,
        ...totals(matches, wins),
        share: all.matches > 0 ? round(matches / all.matches) : 0,
        winRateLow: matches > 0 ? round(wilsonLowerBound(wins, matches)) : null,
        pickRate: ranking.matches > 0 ? round(matches / ranking.matches) : 0,
        rank: ranked ? place + 1 : null,
        rankedHeroes: ranking.heroes.length,
        score: ranked?.score ?? null,
        tier: ranked?.tier ?? null,
      };
    });
    const mostPlayed = [...positions].sort((a, b) => b.matches - a.matches)[0];

    return {
      available: true,
      day,
      all: totals(all.matches, all.wins),
      positions,
      mostPlayed: mostPlayed.matches > 0 ? mostPlayed.position : null,
    };
  }
}
