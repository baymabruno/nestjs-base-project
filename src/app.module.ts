import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RequestIdPropagation } from './common/request-id-propagation.js';
import { AuthModule } from './authorization/authorization.module.js';
import { Env, envSchema } from './config/env.validation.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { HealthModule } from './health/health.module.js';
import { ObserveModule, isObserveEnabled } from './observe.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('THROTTLE_TTL', { infer: true }),
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    ConditionalModule.registerWhen(
      ObserveModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService<Env, true>) => ({
          appKey: config.get('OBSERVE_APP_KEY', { infer: true }) ?? '',
          appSecret: config.get('OBSERVE_APP_SECRET', { infer: true }) ?? '',
          serviceId: config.get('OBSERVE_SERVICE_ID', { infer: true }),
          forwardLogs: true,
          // expected errors are reported without their spans (fewer events)
          skipSpans: [400, 401, 403, 404, 429],
        }),
      }),
      isObserveEnabled,
    ),
    HttpModule.register({ timeout: 5000, maxRedirects: 5 }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RequestIdPropagation,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
