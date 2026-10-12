import { ConfigService } from '@nestjs/config';
import { Env } from '../../src/config/env.validation.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/** Client of the test database (see test/setup-db.ts) */
export const createTestPrisma = () =>
  new PrismaService(
    new ConfigService({
      DATABASE_URL: process.env.DATABASE_URL,
    }) as ConfigService<Env, true>,
  );

/** Removes every row, so each test starts from an empty database */
export const resetDatabase = (prisma: PrismaService) =>
  prisma.$executeRawUnsafe(
    'TRUNCATE match_players, matches, heroes, items, patches, hero_stats, hero_item_stats, hero_daily_stats, hero_matchup_stats, hero_item_timing_stats, hero_position_daily_stats, hero_skill_build_stats, hero_talent_stats, abilities, hero_talents, ability_display_names, hero_role_item_timings, hero_role_starting_items',
  );
