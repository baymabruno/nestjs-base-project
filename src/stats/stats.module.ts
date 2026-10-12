import { Module } from '@nestjs/common';
import { HeroService } from './hero.service.js';
import { MetaService } from './meta.service.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  controllers: [StatsController],
  providers: [StatsService, MetaService, HeroService],
  exports: [StatsService],
})
export class StatsModule {}
