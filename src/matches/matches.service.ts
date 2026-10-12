import { Injectable } from '@nestjs/common';
import { GameDataService } from '../game-data/game-data.service.js';
import {
  DetailsStatus,
  MatchSource,
  Prisma,
} from '../generated/prisma/client.js';
import {
  MatchDetails,
  ProMatch,
  PublicMatch,
} from '../opendota/opendota.schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';

// dire player slots start at 128 (radiant: 0-4)
const DIRE_SLOT = 128;
// attempts to get the details of a match (parsed, for pro matches)
export const MAX_DETAILS_ATTEMPTS = 5;
// wait before trying again; grows with each attempt (30, 60, 90 min...)
export const DETAILS_RETRY_DELAY_MS = 30 * 60 * 1000;

export interface PendingMatch {
  id: number;
  source: MatchSource;
  detailsAttempts: number;
}

const toDate = (unixSeconds: number) => new Date(unixSeconds * 1000);

/** Stores the matches and their players (heroes, items and purchases) */
@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
  ) {}

  /**
   * Stores new public matches with the heroes of each team; the items come
   * later, from the details. Returns how many matches were new.
   */
  async addPublicMatches(matches: PublicMatch[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.match.createManyAndReturn({
        data: matches.map((match) => ({
          ...this.matchFields(match, MatchSource.PUBLIC),
          avgRankTier: match.avg_rank_tier,
        })),
        select: { id: true },
        skipDuplicates: true,
      });
      const createdIds = new Set(created.map((match) => match.id));

      const players = matches
        .filter((match) => createdIds.has(BigInt(match.match_id)))
        .flatMap((match) => {
          const common = {
            matchId: BigInt(match.match_id),
            source: MatchSource.PUBLIC,
            patchId: this.gameData.patchAt(toDate(match.start_time)).id,
            startTime: toDate(match.start_time),
          };
          return [
            ...match.radiant_team.map((heroId, index) => ({
              ...common,
              playerSlot: index,
              heroId,
              win: match.radiant_win,
            })),
            ...match.dire_team.map((heroId, index) => ({
              ...common,
              playerSlot: DIRE_SLOT + index,
              heroId,
              win: !match.radiant_win,
            })),
          ];
        });
      await tx.matchPlayer.createMany({ data: players });

      return created.length;
    });
  }

  /**
   * Stores new professional matches; the players come from the details.
   * Returns how many matches were new.
   */
  async addProMatches(matches: ProMatch[]): Promise<number> {
    const { count } = await this.prisma.match.createMany({
      data: matches
        // matches without a result (e.g. abandoned) are ignored
        .filter((match) => match.radiant_win !== null)
        .map((match) => ({
          ...this.matchFields(
            { ...match, radiant_win: match.radiant_win === true },
            MatchSource.PRO,
          ),
          leagueId: match.leagueid,
        })),
      skipDuplicates: true,
    });
    return count;
  }

  /**
   * Matches waiting for their details: pro first, then the newest; only the
   * ones started since the date, when given
   */
  async findPendingDetails(
    limit: number,
    { source, since }: { source?: MatchSource; since?: Date } = {},
  ): Promise<PendingMatch[]> {
    if (limit <= 0) return [];
    const matches = await this.prisma.match.findMany({
      where: {
        detailsStatus: DetailsStatus.PENDING,
        detailsAfter: { lte: new Date() },
        ...(source && { source }),
        ...(since && { startTime: { gte: since } }),
      },
      orderBy: [{ source: 'asc' }, { startTime: 'desc' }],
      select: { id: true, source: true, detailsAttempts: true },
      take: limit,
    });
    return matches.map((match) => ({ ...match, id: Number(match.id) }));
  }

  /**
   * Stores the players of a match with their items. A pro match that was not
   * parsed yet (no purchase order) is tried again later.
   */
  async saveDetails(match: PendingMatch, details: MatchDetails) {
    const parsed = details.players.some((player) => player.purchase_log);
    const attempts = match.detailsAttempts + 1;
    const retry =
      !parsed &&
      match.source === MatchSource.PRO &&
      attempts < MAX_DETAILS_ATTEMPTS;

    const startTime = toDate(details.start_time);
    const patchId = this.gameData.patchAt(startTime).id;
    const matchId = BigInt(match.id);

    const players: Prisma.MatchPlayerCreateManyInput[] = details.players.map(
      (player) => {
        const purchases = (player.purchase_log ?? []).flatMap((purchase) => {
          const itemId = this.gameData.itemId(purchase.key);
          return itemId ? [{ itemId, time: purchase.time }] : [];
        });
        return {
          matchId,
          playerSlot: player.player_slot,
          heroId: player.hero_id,
          win: player.isRadiant === details.radiant_win,
          source: match.source,
          patchId,
          startTime,
          accountId: player.account_id ? BigInt(player.account_id) : null,
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,
          items: [
            player.item_0,
            player.item_1,
            player.item_2,
            player.item_3,
            player.item_4,
            player.item_5,
          ].filter((itemId) => itemId > 0),
          neutralItemId: player.item_neutral || null,
          purchaseItems: purchases.map((purchase) => purchase.itemId),
          purchaseTimes: purchases.map((purchase) => purchase.time),
          abilityUpgrades: player.ability_upgrades_arr ?? [],
        };
      },
    );

    await this.prisma.$transaction([
      this.prisma.matchPlayer.deleteMany({ where: { matchId } }),
      this.prisma.matchPlayer.createMany({ data: players }),
      this.prisma.match.update({
        where: { id: matchId },
        data: {
          detailsStatus: parsed
            ? DetailsStatus.PARSED
            : retry
              ? DetailsStatus.PENDING
              : DetailsStatus.FETCHED,
          detailsAttempts: attempts,
          detailsAfter: this.retryAt(attempts),
        },
      }),
    ]);
  }

  /** The details could not be fetched: try again later or give up */
  async registerDetailsFailure(match: PendingMatch) {
    const attempts = match.detailsAttempts + 1;
    await this.prisma.match.update({
      where: { id: BigInt(match.id) },
      data: {
        detailsStatus:
          attempts < MAX_DETAILS_ATTEMPTS
            ? DetailsStatus.PENDING
            : DetailsStatus.FAILED,
        detailsAttempts: attempts,
        detailsAfter: this.retryAt(attempts),
      },
    });
  }

  /** Deletes the matches (and their players) that started before the date */
  async deleteStartedBefore({
    publicBefore,
    proBefore,
  }: {
    publicBefore: Date;
    proBefore: Date;
  }): Promise<number> {
    const { count } = await this.prisma.match.deleteMany({
      where: {
        OR: [
          { source: MatchSource.PUBLIC, startTime: { lt: publicBefore } },
          { source: MatchSource.PRO, startTime: { lt: proBefore } },
        ],
      },
    });
    return count;
  }

  private matchFields(
    match: Pick<
      PublicMatch,
      'match_id' | 'start_time' | 'duration' | 'radiant_win'
    >,
    source: MatchSource,
  ) {
    const startTime = toDate(match.start_time);
    return {
      id: BigInt(match.match_id),
      source,
      startTime,
      duration: match.duration,
      radiantWin: match.radiant_win,
      patchId: this.gameData.patchAt(startTime).id,
    };
  }

  private retryAt(attempts: number) {
    return new Date(Date.now() + attempts * DETAILS_RETRY_DELAY_MS);
  }
}
