import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  heroDetailsSchema,
  heroItemTimingsQuerySchema,
  heroItemTimingsSchema,
  heroMatchupsQuerySchema,
  heroMatchupsSchema,
  heroesQuerySchema,
  heroIdSchema,
  heroListSchema,
  heroQuerySchema,
  metaHeroesQuerySchema,
  metaHeroesSchema,
  metaSchema,
  type HeroDetails,
  type HeroItemTimings,
  type HeroItemTimingsQuery,
  type HeroMatchups,
  type HeroMatchupsQuery,
  type HeroesQuery,
  type HeroId,
  type HeroList,
  type HeroQuery,
  type Meta,
  type MetaHeroes,
  type MetaHeroesQuery,
} from './schemas/stats.schemas.js';
import { HeroService } from './hero.service.js';
import { MetaService } from './meta.service.js';
import { StatsService } from './stats.service.js';

// public routes: statistics of the current patch
@ApiTags('Stats')
@Controller()
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly meta: MetaService,
    private readonly hero: HeroService,
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

  @Get('/heroes/:heroId/matchups')
  @ApiOkResponse({
    description:
      'Win rate of the hero against each enemy and with each ally (current patch)',
    standardSchema: heroMatchupsSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getMatchups(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroMatchupsQuerySchema }) query: HeroMatchupsQuery,
  ): Promise<HeroMatchups> {
    return this.hero.getMatchups(heroId, query);
  }

  @Get('/heroes/:heroId/item-timings')
  @ApiOkResponse({
    description:
      'Items bought by the hero, with the win rate by the time of the first purchase (parsed matches of the current patch)',
    standardSchema: heroItemTimingsSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getItemTimings(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroItemTimingsQuerySchema }) query: HeroItemTimingsQuery,
  ): Promise<HeroItemTimings> {
    return this.hero.getItemTimings(heroId, query);
  }
}
