import { LogLevel } from '@nestjs/common';
import { createPrivateKey, createPublicKey, KeyObject } from 'crypto';
import { z } from 'zod';

export const LOG_LEVELS: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

// PEM keys are stored base64 encoded, so they fit in a single .env line
const base64Pem = z
  .string()
  .min(1)
  .transform((value) => Buffer.from(value, 'base64').toString('utf8'));

const keyOrNull = (load: () => KeyObject) => {
  try {
    return load();
  } catch {
    return null;
  }
};

export const envSchema = z
  .object({
    APP_ENVIRONMENT: z.string().default('develop'),
    PORT: z.coerce.number().int().positive().default(3000),
    SWAGGER: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    LOG_LEVEL: z.enum(LOG_LEVELS as [LogLevel, ...LogLevel[]]).default('log'),
    // comma separated list, e.g. "https://app.example.com,https://admin.example.com"
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    // Express "trust proxy": "false", "true", the number of proxies in front
    // of the app (e.g. "1") or a list of trusted addresses/subnets
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((value): boolean | number | string => {
        if (value === 'true' || value === 'false') return value === 'true';
        return /^\d+$/.test(value) ? Number(value) : value;
      }),
    // PostgreSQL connection, e.g. postgresql://user:password@host:5432/database
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgresql:// connection URL'),
    // OpenDota API (https://docs.opendota.com)
    OPENDOTA_API_URL: z.url().default('https://api.opendota.com/api'),
    // optional: raises the request limits (paid plan)
    OPENDOTA_API_KEY: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    // minimum time between requests; 1100ms stays under 60 requests/minute
    OPENDOTA_REQUEST_INTERVAL_MS: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(1100),
    // STRATZ API (https://stratz.com/api): hero statistics by position
    STRATZ_API_URL: z.url().default('https://api.stratz.com/graphql'),
    // optional: without it the statistics by role are not collected
    STRATZ_API_TOKEN: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    // hours between the requests for the statistics by role
    STRATZ_INTERVAL_HOURS: z.coerce.number().int().positive().default(6),
    // window of the public matches: those of the last hours count, and the
    // older ones are deleted every hour (pro matches: the whole current patch)
    PUBLIC_WINDOW_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    // minutes between the requests for the latest pro and public matches
    PRO_MATCHES_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(15),
    PUBLIC_MATCHES_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    // minimum average rank of the public matches (tens: 7 Divine, 8 Immortal)
    PUBLIC_MIN_RANK_TIER: z.coerce.number().int().min(10).max(80).default(70),
    // minutes between the statistics updates
    STATS_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
    // match details requested per minute, at most
    DETAILS_PER_MINUTE: z.coerce.number().int().positive().default(30),
    // daily OpenDota requests kept for the match lists
    OPENDOTA_DAILY_RESERVE: z.coerce.number().int().nonnegative().default(150),
    THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    // observability (@nestjs/observe): enabled only when key and secret are set
    OBSERVE_APP_KEY: z.string().optional(),
    OBSERVE_APP_SECRET: z.string().optional(),
    OBSERVE_SERVICE_ID: z.string().min(1).default('dota-metrics'),
    // RSA key pair (RS256): only this service signs tokens with the private
    // key; other services validate them with the public key
    JWT_PRIVATE_KEY: base64Pem,
    JWT_PUBLIC_KEY: base64Pem,
    JWT_ISSUER: z.string().min(1).default('dota-metrics'),
    JWT_AUDIENCE: z.string().min(1).default('dota-metrics'),
    // access token lifetime in seconds
    JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
    // refresh token lifetime in seconds
    JWT_REFRESH_EXPIRES_IN: z.coerce.number().int().positive().default(604800),
  })
  .superRefine((env, ctx) => {
    const privateKey = keyOrNull(() => createPrivateKey(env.JWT_PRIVATE_KEY));
    const publicKey = keyOrNull(() => createPublicKey(env.JWT_PUBLIC_KEY));

    if (!privateKey || privateKey.asymmetricKeyType !== 'rsa') {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_PRIVATE_KEY'],
        message: 'must be a base64 encoded RSA private key (PEM)',
      });
    } else if ((privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_PRIVATE_KEY'],
        message: 'RSA key must have at least 2048 bits',
      });
    }

    if (!publicKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_PUBLIC_KEY'],
        message: 'must be a base64 encoded RSA public key (PEM)',
      });
    }

    if (privateKey && publicKey) {
      const derived = createPublicKey(privateKey).export({ format: 'jwk' });
      const given = publicKey.export({ format: 'jwk' });
      if (derived.n !== given.n || derived.e !== given.e) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_PUBLIC_KEY'],
          message: 'does not match JWT_PRIVATE_KEY',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export const isProduction = (environment: string) =>
  environment === 'production';
