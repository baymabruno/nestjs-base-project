import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StratzClient } from './stratz.client.js';

/** Hero statistics by position (STRATZ), stored in hero_position_daily_stats */
@Injectable()
export class PositionStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stratz: StratzClient,
  ) {}

  get isConfigured(): boolean {
    return this.stratz.isConfigured;
  }

  /**
   * Replaces the days returned by STRATZ (the latest day may still be
   * incomplete in the previous sync). Returns how many rows were stored.
   */
  async sync(days: number): Promise<number> {
    const rows = await this.stratz.getHeroPositionDays(days);
    if (rows.length === 0) return 0;
    const firstDay = new Date(
      Math.min(...rows.map((row) => row.day.getTime())),
    );

    const [, { count }] = await this.prisma.$transaction([
      this.prisma.heroPositionDailyStat.deleteMany({
        where: { day: { gte: firstDay } },
      }),
      this.prisma.heroPositionDailyStat.createMany({ data: rows }),
    ]);
    return count;
  }

  /** Deletes the days before the date (retention) */
  async deleteBefore(date: Date): Promise<number> {
    const { count } = await this.prisma.heroPositionDailyStat.deleteMany({
      where: { day: { lt: date } },
    });
    return count;
  }
}
