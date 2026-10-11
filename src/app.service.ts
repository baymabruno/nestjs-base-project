import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Env } from './config/env.validation.js';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Example of an outgoing HTTP call: requests this API's own health check
  async fetchExample(): Promise<unknown> {
    const port = this.config.get('PORT', { infer: true });

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`http://localhost:${port}/health`),
      );
      return data;
    } catch (error) {
      this.logger.error('Example request failed', { error: String(error) });
      throw new BadGatewayException('example request failed');
    }
  }
}
