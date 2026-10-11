import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AppService } from './app.service.js';
import { Env } from './config/env.validation.js';

describe('AppService', () => {
  const get = vi.fn();
  const service = new AppService(
    { get } as unknown as HttpService,
    new ConfigService({ PORT: 3000 }) as ConfigService<Env, true>,
  );

  beforeEach(() => get.mockReset());

  it('returns the response of the example request', async () => {
    get.mockReturnValue(of({ data: { status: 'ok' } }));

    await expect(service.fetchExample()).resolves.toEqual({ status: 'ok' });
    expect(get).toHaveBeenCalledWith('http://localhost:3000/health');
  });

  it('answers 502 when the example request fails', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    await expect(service.fetchExample()).rejects.toThrow(BadGatewayException);
  });
});
