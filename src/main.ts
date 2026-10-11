import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppLogger } from './common/app-logger.js';
import { Env, isProduction, LOG_LEVELS } from './config/env.validation.js';
import { ObserveInstrument } from './observe.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // no effect while observability is disabled (see observe.ts)
    instrument: ObserveInstrument,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const production = isProduction(
    config.get('APP_ENVIRONMENT', { infer: true }),
  );

  // LOG_LEVEL enables the given level and every level more severe than it
  const logLevel = config.get('LOG_LEVEL', { infer: true });
  app.useLogger(
    new AppLogger({
      logLevels: LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel)),
      json: production,
      colors: !production,
    }),
  );

  configureApp(app);

  await app.listen(config.get('PORT', { infer: true }));

  new Logger('Bootstrap').log(`Server is listening on: ${await app.getUrl()}`);
}
await bootstrap();
