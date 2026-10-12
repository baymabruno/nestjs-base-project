import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { createAppLogger } from './common/app-logger.js';
import { Env } from './config/env.validation.js';
import { ObserveInstrument } from './observe.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // no effect while observability is disabled (see observe.ts)
    instrument: ObserveInstrument,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.useLogger(createAppLogger(config));

  configureApp(app);

  await app.listen(config.get('PORT', { infer: true }));

  new Logger('Bootstrap').log(`Server is listening on: ${await app.getUrl()}`);
}
await bootstrap();
