import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env, isProduction, LOG_LEVELS } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const production = isProduction(
    config.get('APP_ENVIRONMENT', { infer: true }),
  );

  // LOG_LEVEL enables the given level and every level more severe than it
  const logLevel = config.get('LOG_LEVEL', { infer: true });
  app.useLogger(
    new ConsoleLogger({
      logLevels: LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel)),
      json: production,
      colors: !production,
    }),
  );

  configureApp(app);

  await app.listen(config.get('PORT', { infer: true }));

  new Logger('Bootstrap').log(`Server is listening on: ${await app.getUrl()}`);
}
bootstrap();
