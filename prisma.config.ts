import { defineConfig } from 'prisma/config';

// the Prisma CLI does not read .env by itself; existing variables (e.g. from
// docker-compose or CI) take precedence over the file
try {
  process.loadEnvFile();
} catch {
  // no .env file: the variables come from the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // only migrate/introspection use it; "prisma generate" runs without it
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
