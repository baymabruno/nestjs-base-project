import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { BackfillModule } from './backfill.module.js';
import { createAppLogger } from './common/app-logger.js';
import { Env } from './config/env.validation.js';
import {
  BackfillProgress,
  BackfillService,
  parseBackfillDays,
} from './ingestion/backfill.service.js';

// Loads the matches of the last days: node dist/backfill.js [days]
// (./setup.sh backfill [days]); 1 day when omitted
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
    const days = parseBackfillDays(
      process.argv[2],
      config.get('MATCH_RETENTION_DAYS', { infer: true }),
    );
    logger.log(`Loading the matches of the last ${days} days`);

    const result = await app.get(BackfillService).run(days);

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
