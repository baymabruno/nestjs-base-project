import {
  Controller,
  Get,
  Logger,
  Render,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  // home page: outside the /api prefix and the versioning
  @Get()
  @Version(VERSION_NEUTRAL)
  @ApiExcludeEndpoint()
  @Render('index')
  render() {
    return {
      message: this.appService.getHello(),
      version: this.appService.getVersion(),
    };
  }

  @Get('status')
  @ApiOkResponse()
  status() {
    this.logger.debug('status called');
    return { success: '200' };
  }

  @Get('axios')
  @ApiOkResponse({ description: 'Response of the example request' })
  @ApiBadGatewayResponse({ description: 'Example request failed' })
  axiosExample() {
    return this.appService.fetchExample();
  }
}
