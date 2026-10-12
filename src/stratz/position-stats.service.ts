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
   * Replaces the statistics with the latest day of STRATZ (it has whole days
   * only, about a day behind). Returns how many rows were stored.
   */
  async sync(): Promise<number> {
    const rows = await this.stratz.getHeroPositionDays(1);
    const [, { count }] = await this.prisma.$transaction([
      this.prisma.heroPositionDailyStat.deleteMany(),
      this.prisma.heroPositionDailyStat.createMany({ data: rows }),
    ]);
    return count;
  }
}
