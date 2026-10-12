import { Module } from '@nestjs/common';
import { MetaService } from './meta.service.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  controllers: [StatsController],
  providers: [StatsService, MetaService],
  exports: [StatsService],
})
export class StatsModule {}
