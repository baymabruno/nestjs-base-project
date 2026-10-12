import { Module } from '@nestjs/common';
import { GameDataModule } from '../game-data/game-data.module.js';
import { MatchesService } from './matches.service.js';

@Module({
  imports: [GameDataModule],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
