import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      // services tested against a real database
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int-spec.ts'],
          globalSetup: ['./test/setup-db.ts'],
          setupFiles: ['./test/setup-env.ts', './test/setup-integration.ts'],
          // the files share the database
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['./test/setup-db.ts'],
          setupFiles: ['./test/setup-env.ts'],
          fileParallelism: false,
        },
      },
    ],
    // `npm run test:cov` measures unit and e2e tests together
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts only bootstraps the app; interfaces have no runtime code;
      // src/generated is the Prisma client
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.int-spec.ts',
        'src/main.ts',
        'src/**/interfaces/**',
        'src/generated/**',
      ],
      reportsDirectory: './coverage',
      // the build fails (CI included) when coverage drops below these values
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
    },
  },
});
