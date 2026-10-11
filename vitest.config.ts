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
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          setupFiles: ['./test/setup-env.ts'],
        },
      },
    ],
    // `npm run test:cov` measures unit and e2e tests together
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts only bootstraps the app; interfaces have no runtime code
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/interfaces/**'],
      reportsDirectory: './coverage',
      // the build fails (CI included) when coverage drops below these values
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
    },
  },
});
