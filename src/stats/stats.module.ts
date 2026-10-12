import { Module } from '@nestjs/common';
import { AbilitiesService } from './abilities.service.js';
import { HeroService } from './hero.service.js';
import { MetaService } from './meta.service.js';
import { RoleItemsQueryService } from './role-items.service.js';
import { RolesService } from './roles.service.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  controllers: [StatsController],
  providers: [
    StatsService,
    MetaService,
    HeroService,
    RolesService,
    AbilitiesService,
    RoleItemsQueryService,
  ],
  exports: [StatsService],
})
export class StatsModule {}
