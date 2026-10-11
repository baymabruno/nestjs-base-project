import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RequestContext } from './request-context.js';

/**
 * Sends the current request id (X-Request-Id) on outgoing HttpService
 * requests, so a request can be traced across services.
 */
@Injectable()
export class RequestIdPropagation implements OnModuleInit {
  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    this.httpService.axiosRef.interceptors.request.use((config) => {
      const requestId = RequestContext.getRequestId();
      if (requestId && !config.headers.has('X-Request-Id')) {
        config.headers.set('X-Request-Id', requestId);
      }
      return config;
    });
  }
}
