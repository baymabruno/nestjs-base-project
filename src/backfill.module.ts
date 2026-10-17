import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { workerEnvSchema } from './config/env.validation.js';
import { GameDataModule } from './game-data/game-data.module.js';
import { BackfillService } from './ingestion/backfill.service.js';
import { MatchesModule } from './matches/matches.module.js';
import { OpenDotaModule } from './opendota/opendota.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/** Backfill command: loads past matches and exits (see src/backfill.ts) */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: workerEnvSchema }),
    PrismaModule,
    OpenDotaModule,
    GameDataModule,
    MatchesModule,
  ],
  providers: [BackfillService],
})
export class BackfillModule {}
