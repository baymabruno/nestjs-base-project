import { Controller, Get, Logger, Render } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';
import axios from 'axios';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger();

  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  @Render('index')
  render(): any {
    const message = this.appService.getHello();
    return { message };
  }

  @Get('/api')
  @ApiResponse({
    status: 200,
  })
  async index() {
    this.logger.log('teste');
    this.logger.error('teste');
    this.logger.warn('teste');
    this.logger.debug('teste');
    this.logger.verbose('teste');
    return { success: '200' };
  }

  @Get('/api/axios')
  @ApiResponse({
    status: 200,
  })
  async axiosExample() {
    try {
      const response = await axios.get('http://localhost:3000/api');
      console.log(response.data);
    } catch (error) {
      console.error(error);
    }
  }
}
