import { Controller, Get } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

/**
 * Example of a call to another service with the HttpService: the request id
 * (X-Request-Id) is sent along, so the call can be traced across services.
 * Remove it when starting a new project.
 */
@ApiTags('Example')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('axios')
  @ApiOkResponse({ description: 'Response of the example request' })
  @ApiBadGatewayResponse({ description: 'Example request failed' })
  axiosExample() {
    return this.appService.fetchExample();
  }
}
