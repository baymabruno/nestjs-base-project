import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwksService, type Jwks } from './jwks.service.js';

// standard location, outside the /api prefix and the versioning
@ApiTags('Authorization')
@SkipThrottle()
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class JwksController {
  constructor(private readonly jwksService: JwksService) {}

  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOkResponse({ description: 'Public keys to validate the access tokens' })
  getJwks(): Jwks {
    return this.jwksService.getJwks();
  }
}
