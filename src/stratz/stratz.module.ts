import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PositionStatsService } from './position-stats.service.js';
import { RoleItemsService } from './role-items.service.js';
import { StratzClient } from './stratz.client.js';
import { TalentStatsService } from './talent-stats.service.js';

@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  providers: [
    StratzClient,
    PositionStatsService,
    TalentStatsService,
    RoleItemsService,
  ],
  exports: [PositionStatsService, TalentStatsService, RoleItemsService],
})
export class StratzModule {}
