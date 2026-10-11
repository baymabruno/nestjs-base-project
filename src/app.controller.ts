import {
  Controller,
  Get,
  Render,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
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
}
