import { HttpService } from '@nestjs/axios';
import axios, { InternalAxiosRequestConfig } from 'axios';
import { RequestContext } from './request-context.js';
import { RequestIdPropagation } from './request-id-propagation.js';

describe('RequestIdPropagation', () => {
  let sentHeaders: InternalAxiosRequestConfig['headers'] | undefined;
  let httpService: HttpService;

  beforeEach(() => {
    const instance = axios.create({
      // captures the request instead of sending it
      adapter: async (config) => {
        sentHeaders = config.headers;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    httpService = new HttpService(instance);
    new RequestIdPropagation(httpService).onModuleInit();
  });

  it('sends the current request id', async () => {
    await RequestContext.run({ requestId: 'req-1' }, () =>
      httpService.axiosRef.get('http://service'),
    );

    expect(sentHeaders?.get('X-Request-Id')).toBe('req-1');
  });

  it('does not add a header outside a request', async () => {
    await httpService.axiosRef.get('http://service');

    expect(sentHeaders?.has('X-Request-Id')).toBe(false);
  });
});
