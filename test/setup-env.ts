import { generateJwtKeys } from './support/jwt-keys.js';

const keys = generateJwtKeys();
process.env.JWT_PRIVATE_KEY ??= keys.JWT_PRIVATE_KEY;
process.env.JWT_PUBLIC_KEY ??= keys.JWT_PUBLIC_KEY;
// the e2e tests simulate a reverse proxy with X-Forwarded-For
process.env.TRUST_PROXY ??= '1';
// documentation routes (/doc, /doc-json) are tested too
process.env.SWAGGER ??= 'true';
