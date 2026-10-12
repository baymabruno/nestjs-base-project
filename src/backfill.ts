import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { BackfillModule } from './backfill.module.js';
import { createAppLogger } from './common/app-logger.js';
import { Env } from './config/env.validation.js';
import {
  BackfillProgress,
  BackfillService,
} from './ingestion/backfill.service.js';

// Loads the matches the worker did not collect: the public ones of the last
// PUBLIC_WINDOW_HOURS and the pro ones of the current patch
// (node dist/backfill.js, or ./setup.sh backfill)
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    bufferLogs: true,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.useLogger(createAppLogger(config));
  const logger = new Logger('Backfill');

  const describe = (name: string, progress: BackfillProgress) =>
    `${name}: ${progress.added} new matches in ${progress.pages} pages` +
    (progress.oldest ? `, back to ${progress.oldest.toISOString()}` : '') +
    (progress.complete ? '' : ' (incomplete: run again later)');

  try {
    logger.log(
      `Loading the public matches of the last ${config.get('PUBLIC_WINDOW_HOURS', { infer: true })} hours and the pro matches of the current patch`,
    );

    const result = await app.get(BackfillService).run();

    logger.log(describe('Pro', result.pro));
    logger.log(describe('Public', result.public));
    logger.log(
      'The worker fetches the details (items) of the new matches within the daily quota',
    );
  } catch (error) {
    logger.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
await bootstrap();
