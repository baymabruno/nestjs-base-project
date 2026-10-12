import { Module } from '@nestjs/common';
import { OpenDotaModule } from '../opendota/opendota.module.js';
import { GameDataService } from './game-data.service.js';

@Module({
  imports: [OpenDotaModule],
  providers: [GameDataService],
  exports: [GameDataService],
})
export class GameDataModule {}
