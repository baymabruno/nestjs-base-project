import { generateJwtKeys } from './jwt-keys.js';

/** Required environment variables (envSchema) with valid test values */
export const requiredEnv = () => ({
  ...generateJwtKeys(),
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
});
