import { ConsoleLogger, LogLevel } from '@nestjs/common';
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
