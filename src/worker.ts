import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createAppLogger } from './common/app-logger.js';
import { Env } from './config/env.validation.js';
import { WorkerModule } from './worker.module.js';

// Separate process from the API (see ecosystem.config.cjs): the API can run
// several instances, while the matches must be collected by only one
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(
    createAppLogger(app.get<ConfigService<Env, true>>(ConfigService)),
  );
  // stops the jobs and closes the database connection on SIGTERM (PM2)
  app.enableShutdownHooks();

  new Logger('Bootstrap').log('Worker started');
}
await bootstrap();
