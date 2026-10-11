import { ConsoleLogger } from '@nestjs/common';
import { AppLogger } from './app-logger.js';
import { RequestContext } from './request-context.js';

describe('AppLogger', () => {
  const printMessages = vi
    .spyOn(ConsoleLogger.prototype as any, 'printMessages')
    .mockImplementation(() => undefined);

  beforeEach(() => printMessages.mockClear());

  const paramsOfLastLog = () => printMessages.mock.calls.at(-1)?.[5];

  it('adds the request id to logs written during a request', () => {
    RequestContext.run({ requestId: 'req-1' }, () =>
      new AppLogger().log('user created', { userId: 1 }),
    );

    expect(paramsOfLastLog()).toEqual({ requestId: 'req-1', userId: 1 });
  });

  it('keeps logs outside a request unchanged', () => {
    new AppLogger().log('started');

    expect(paramsOfLastLog()).toBeUndefined();
  });
});
