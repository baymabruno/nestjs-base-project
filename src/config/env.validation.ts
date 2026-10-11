import { LogLevel } from '@nestjs/common';
import { z } from 'zod';

export const LOG_LEVELS: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

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
    JWT_KEY: z.string().min(1),
    JWT_EXPIRES_IN: z.coerce.number().int().positive(),
  })
  .superRefine((env, ctx) => {
    if (isProduction(env.APP_ENVIRONMENT) && env.JWT_KEY.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_KEY'],
        message: 'JWT_KEY must have at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const isProduction = (environment: string) =>
  environment === 'production';
