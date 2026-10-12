import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  heroAbilitiesQuerySchema,
  heroAbilitiesSchema,
  heroDetailsSchema,
  heroRoleItemsQuerySchema,
  heroRoleItemsSchema,
  heroRolesQuerySchema,
  heroRolesSchema,
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
  rolesQuerySchema,
  rolesSchema,
  type HeroAbilities,
  type HeroAbilitiesQuery,
  type HeroDetails,
  type HeroRoleItems,
  type HeroRoleItemsQuery,
  type HeroRoles,
  type HeroRolesQuery,
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
  type Roles,
  type RolesQuery,
} from './schemas/stats.schemas.js';
import { AbilitiesService } from './abilities.service.js';
import { HeroService } from './hero.service.js';
import { MetaService } from './meta.service.js';
import { RoleItemsQueryService } from './role-items.service.js';
import { RolesService } from './roles.service.js';
import { StatsService } from './stats.service.js';

// public routes: statistics of the current patch
@ApiTags('Stats')
@Controller()
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly meta: MetaService,
    private readonly hero: HeroService,
    private readonly roles: RolesService,
    private readonly abilities: AbilitiesService,
    private readonly roleItems: RoleItemsQueryService,
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

  @Get('/meta/roles')
  @ApiOkResponse({
    description:
      'Heroes by role (position 1 to 5) in ranked Divine and Immortal matches (STRATZ), with a score and a tier',
    standardSchema: rolesSchema,
  })
  getRoles(
    @Query({ schema: rolesQuerySchema }) query: RolesQuery,
  ): Promise<Roles> {
    return this.roles.getHeroes(query);
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

  @Get('/heroes/:heroId/abilities')
  @ApiOkResponse({
    description:
      'Most common ability builds (first 10 levels) and the talent tree with the picks of each option',
    standardSchema: heroAbilitiesSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getAbilities(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroAbilitiesQuerySchema }) query: HeroAbilitiesQuery,
  ): Promise<HeroAbilities> {
    return this.abilities.getHeroAbilities(heroId, query);
  }

  @Get('/heroes/:heroId/roles')
  @ApiOkResponse({
    description:
      'The hero in each role (STRATZ): matches, win rate, share and score',
    standardSchema: heroRolesSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getHeroRoles(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroRolesQuerySchema }) query: HeroRolesQuery,
  ): Promise<HeroRoles> {
    return this.roles.getHeroRoles(heroId, query);
  }

  @Get('/heroes/:heroId/role-items')
  @ApiOkResponse({
    description:
      'Starting items and the minute of the first purchase of each item of the hero in a position (STRATZ, latest week)',
    standardSchema: heroRoleItemsSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown hero' })
  getRoleItems(
    @Param({ schema: heroIdSchema }) { heroId }: HeroId,
    @Query({ schema: heroRoleItemsQuerySchema }) query: HeroRoleItemsQuery,
  ): Promise<HeroRoleItems> {
    return this.roleItems.getHeroRoleItems(heroId, query);
  }
}
