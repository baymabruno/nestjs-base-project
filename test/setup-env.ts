import { inject } from 'vitest';
import { generateJwtKeys } from './support/jwt-keys.js';

const keys = generateJwtKeys();
// fixed values, so the tests do not depend on the developer's .env
process.env.JWT_ISSUER = 'e2e-issuer';
process.env.JWT_AUDIENCE = 'e2e-audience';
process.env.JWT_PRIVATE_KEY ??= keys.JWT_PRIVATE_KEY;
process.env.JWT_PUBLIC_KEY ??= keys.JWT_PUBLIC_KEY;
// the e2e tests simulate a reverse proxy with X-Forwarded-For
process.env.TRUST_PROXY ??= '1';
// documentation routes (/doc, /doc-json) are tested too
process.env.SWAGGER ??= 'true';
// database created by test/setup-db.ts for this test project
process.env.DATABASE_URL = inject('databaseUrl');
