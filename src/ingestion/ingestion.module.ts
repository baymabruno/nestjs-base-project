import { Module } from '@nestjs/common';
import { GameDataModule } from '../game-data/game-data.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { OpenDotaModule } from '../opendota/opendota.module.js';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [OpenDotaModule, GameDataModule, MatchesModule],
  providers: [IngestionService, IngestionScheduler],
})
export class IngestionModule {}
