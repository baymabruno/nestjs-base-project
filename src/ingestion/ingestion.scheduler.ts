import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { Env } from '../config/env.validation.js';
import { IngestionService } from './ingestion.service.js';

const MINUTE_MS = 60 * 1000;

/**
 * Runs the collection jobs. A job is skipped while its previous run has not
 * finished, and a failure is logged without stopping the schedule.
 */
@Injectable()
export class IngestionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestionScheduler.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly ingestion: IngestionService,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    const every = (name: string, minutes: number, job: () => Promise<void>) => {
      this.registry.addInterval(
        name,
        setInterval(() => void this.run(name, job), minutes * MINUTE_MS),
      );
    };

    every(
      'pro-matches',
      this.config.get('PRO_MATCHES_INTERVAL_MINUTES', { infer: true }),
      () => this.collectProMatches(),
    );
    every(
      'public-matches',
      this.config.get('PUBLIC_MATCHES_INTERVAL_MINUTES', { infer: true }),
      () => this.collectPublicMatches(),
    );
    every('match-details', 1, () => this.fetchDetails());

    // first run right away, instead of waiting for the intervals
    void this.run('pro-matches', () => this.collectProMatches()).then(() =>
      this.run('public-matches', () => this.collectPublicMatches()),
    );
  }

  // new heroes, items and patches
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  syncGameData() {
    return this.run('game-data', () => this.ingestion.syncGameData());
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  deleteExpiredMatches() {
    return this.run('retention', async () => {
      const deleted = await this.ingestion.deleteExpiredMatches();
      this.logger.log(`Expired matches deleted: ${deleted}`);
    });
  }

  /** Runs a job unless it is already running; errors are logged */
  async run(name: string, job: () => Promise<void>): Promise<void> {
    if (this.running.has(name)) return;
    this.running.add(name);
    try {
      await job();
    } catch (error) {
      this.logger.error(
        `Job ${name} failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.running.delete(name);
    }
  }

  private async collectProMatches() {
    const added = await this.ingestion.collectProMatches();
    this.logger.log(`Pro matches: ${added} new`);
  }

  private async collectPublicMatches() {
    const added = await this.ingestion.collectPublicMatches();
    this.logger.log(`Public matches: ${added} new`);
  }

  private async fetchDetails() {
    const saved = await this.ingestion.fetchDetails();
    if (saved > 0) this.logger.log(`Match details saved: ${saved}`);
  }
}
