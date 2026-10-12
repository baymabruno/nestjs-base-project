import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PositionStatsService } from './position-stats.service.js';
import { StratzClient } from './stratz.client.js';

@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  providers: [StratzClient, PositionStatsService],
  exports: [PositionStatsService],
})
export class StratzModule {}
