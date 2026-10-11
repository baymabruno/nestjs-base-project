import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';
import { Env } from './config/env.validation';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly version: string = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ).version;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  getVersion(): string {
    return this.version;
  }

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
