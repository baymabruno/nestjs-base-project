import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// accepts ids sent by a client or proxy only when they look safe to log
const VALID_REQUEST_ID = /^[\w-]{1,100}$/;

export const getRequestId = (req: Request): string | undefined => {
  const value = req.headers[REQUEST_ID_HEADER];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Gives every request an id (reusing a valid X-Request-Id header when sent),
 * returned in the X-Request-Id response header and included in the logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const received = getRequestId(req);
    const requestId =
      received && VALID_REQUEST_ID.test(received) ? received : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
