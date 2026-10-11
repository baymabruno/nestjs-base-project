import { generateJwtKeys } from '../../test/support/jwt-keys.js';
import { envSchema } from './env.validation.js';

const keys = generateJwtKeys();
const base = { ...keys, JWT_EXPIRES_IN: '3600' };

describe('envSchema', () => {
  it('applies defaults and converts types', () => {
    const env = envSchema.parse(base);

    expect(env).toMatchObject({
      APP_ENVIRONMENT: 'develop',
      PORT: 3000,
      SWAGGER: false,
      LOG_LEVEL: 'log',
      CORS_ORIGINS: [],
      TRUST_PROXY: false,
      JWT_ISSUER: 'dota-metrics',
      JWT_AUDIENCE: 'dota-metrics',
      JWT_EXPIRES_IN: 3600,
      JWT_REFRESH_EXPIRES_IN: 604800,
    });
    expect(env.JWT_PRIVATE_KEY).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('parses the CORS origin list', () => {
    const env = envSchema.parse({
      ...base,
      CORS_ORIGINS: 'https://a.com, https://b.com,',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('parses TRUST_PROXY=%s', (value, expected) => {
    expect(envSchema.parse({ ...base, TRUST_PROXY: value }).TRUST_PROXY).toBe(
      expected,
    );
  });

  it('requires the JWT settings', () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid log level', () => {
    expect(envSchema.safeParse({ ...base, LOG_LEVEL: 'trace' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid private key', () => {
    const result = envSchema.safeParse({
      ...base,
      JWT_PRIVATE_KEY: Buffer.from('not a key').toString('base64'),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a public key from another key pair', () => {
    const result = envSchema.safeParse({
      ...base,
      JWT_PUBLIC_KEY: generateJwtKeys().JWT_PUBLIC_KEY,
    });

    expect(result.success).toBe(false);
  });
});
