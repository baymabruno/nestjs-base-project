import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  heroDetailsSchema,
  heroesQuerySchema,
  heroIdSchema,
  heroListSchema,
  heroQuerySchema,
  metaHeroesQuerySchema,
  metaHeroesSchema,
  metaSchema,
  type HeroDetails,
  type HeroesQuery,
  type HeroId,
  type HeroList,
  type HeroQuery,
  type Meta,
  type MetaHeroes,
  type MetaHeroesQuery,
} from './schemas/stats.schemas.js';
import { MetaService } from './meta.service.js';
import { StatsService } from './stats.service.js';

// public routes: statistics of the current patch
@ApiTags('Stats')
@Controller()
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly meta: MetaService,
  ) {}

  @Get('/meta')
  @ApiOkResponse({
    description: 'Patch of the statistics and how many matches they include',
    standardSchema: metaSchema,
  })
  @ApiNoContentResponse({ description: 'No statistics calculated yet' })
  getMeta(): Promise<Meta | null> {
    return this.stats.getMeta();
  }

  @Get('/meta/heroes')
  @ApiOkResponse({
    description:
      'Meta page: heroes of the current patch in a period, with the adjusted win rate, win rate by duration and trend',
    standardSchema: metaHeroesSchema,
  })
  getMetaHeroes(
    @Query({ schema: metaHeroesQuerySchema }) query: MetaHeroesQuery,
  ): Promise<MetaHeroes> {
    return this.meta.getHeroes(query);
  }

  @Get('/heroes')
  @ApiOkResponse({
    description: 'Win and pick rates of each hero',
    standardSchema: heroListSchema,
  })
  listHeroes(
    @Query({ schema: heroesQuerySchema }) query: HeroesQuery,
  ): Promise<HeroList> {
    return this.stats.listHeroes(query);
  }

  @Get('/heroes/:heroId')
  @ApiOkResponse({
    description: 'Hero statistics and the items of its final inventory',
    standardSchema: heroDetailsSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getHero(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroQuerySchema }) query: HeroQuery,
  ): Promise<HeroDetails> {
    return this.stats.getHero(heroId, query);
  }
}
