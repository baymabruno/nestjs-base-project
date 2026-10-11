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
