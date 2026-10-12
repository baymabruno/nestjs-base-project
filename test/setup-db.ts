import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { parseEnv } from 'util';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Creates (when missing) and migrates a database for the test project, named
 * after the development database plus the project, e.g.
 * dota_metrics_integration. The tests never touch the development data, and
 * each project has its own database, so they can run at the same time.
 */
export default async function setup(project: TestProject) {
  // read without loading .env into process.env: the test processes inherit
  // it, and the other variables must keep the test values (setup-env.ts)
  const databaseUrl =
    process.env.DATABASE_URL ??
    (existsSync('.env')
      ? parseEnv(readFileSync('.env', 'utf8')).DATABASE_URL
      : undefined);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required by the database tests');
  }

  const url = new URL(databaseUrl);
  const database = `${url.pathname.slice(1)}_${project.name}`;

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }

  url.pathname = `/${database}`;
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  });

  project.provide('databaseUrl', url.toString());
}
