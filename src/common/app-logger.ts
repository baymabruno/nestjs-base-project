import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env, isProduction, LOG_LEVELS } from '../config/env.validation.js';
import { RequestContext } from './request-context.js';

/**
 * Console logger that adds the current request id to every log written while
 * a request is handled.
 */
export class AppLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, any>,
  ): void {
    const requestId = RequestContext.getRequestId();
    const withRequestId =
      requestId && !params?.requestId ? { requestId, ...params } : params;

    super.printMessages(
      messages,
      context,
      logLevel,
      writeStreamType,
      errorStack,
      withRequestId,
    );
  }
}

/**
 * Logger configured from the environment: LOG_LEVEL enables the given level
 * and every level more severe than it; JSON in production, colors otherwise.
 */
export const createAppLogger = (config: ConfigService<Env, true>) => {
  const production = isProduction(
    config.get('APP_ENVIRONMENT', { infer: true }),
  );
  const logLevel = config.get('LOG_LEVEL', { infer: true });

  return new AppLogger({
    logLevels: LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel)),
    json: production,
    colors: !production,
  });
};
