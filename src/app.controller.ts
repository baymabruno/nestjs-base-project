import { Controller, Get, Logger, Render } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  @Render('index')
  render() {
    return {
      message: this.appService.getHello(),
      version: this.appService.getVersion(),
    };
  }

  @Get('/api')
  @ApiOkResponse()
  index() {
    this.logger.debug('api index called');
    return { success: '200' };
  }

  @Get('/api/axios')
  @ApiOkResponse({ description: 'Response of the example request' })
  @ApiBadGatewayResponse({ description: 'Example request failed' })
  axiosExample() {
    return this.appService.fetchExample();
  }
}
