import { envSchema } from './env.validation';

const base = { JWT_KEY: 'secret', JWT_EXPIRES_IN: '3600' };

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
      JWT_EXPIRES_IN: 3600,
    });
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

  it('requires a strong JWT_KEY in production', () => {
    const result = envSchema.safeParse({
      ...base,
      APP_ENVIRONMENT: 'production',
    });

    expect(result.success).toBe(false);
  });
});
