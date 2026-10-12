import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation.js';
import { OpenDotaClient } from './opendota.client.js';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        baseURL: config.get('OPENDOTA_API_URL', { infer: true }),
        // match details can be large
        timeout: 20000,
      }),
    }),
  ],
  providers: [OpenDotaClient],
  exports: [OpenDotaClient],
})
export class OpenDotaModule {}
