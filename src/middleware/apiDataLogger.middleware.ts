import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getRequestId } from './requestId.middleware.js';

@Injectable()
export class ApiRequestLogger implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.logger.log(`${req.method} ${req.originalUrl}`, {
        requestId: getRequestId(req),
        ip: req.ip,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    });

    next();
  }
}
