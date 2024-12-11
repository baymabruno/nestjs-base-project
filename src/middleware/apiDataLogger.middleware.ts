import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ApiRequestLogger implements NestMiddleware {
  private readonly logger = new Logger();

  use(req: Request, res: Response, next: NextFunction) {
    const dataLog = {
      ip: req.ip,
      method: req.method,
      route: req.originalUrl,
    };

    this.logger.log(JSON.stringify(dataLog));
    next();
  }
}
