import { Request, Response } from 'express';
import { RequestContext } from '../common/request-context.js';
import { RequestIdMiddleware } from './requestId.middleware.js';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  const run = (header?: string) => {
    const req = {
      headers: header === undefined ? {} : { 'x-request-id': header },
    } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    let idInsideRequest: string | undefined;

    middleware.use(req, res, () => {
      idInsideRequest = RequestContext.getRequestId();
    });

    return { req, res, idInsideRequest };
  };

  it('reuses a valid X-Request-Id', () => {
    const { req, res, idInsideRequest } = run('trace-123');

    expect(req.headers['x-request-id']).toBe('trace-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'trace-123');
    expect(idInsideRequest).toBe('trace-123');
  });

  it.each([
    ['missing', undefined],
    ['with invalid characters', 'bad id\nInjected: header'],
    ['too long', 'a'.repeat(101)],
  ])('generates a new id when the header is %s', (_, header) => {
    const { req, idInsideRequest } = run(header);

    expect(req.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(idInsideRequest).toBe(req.headers['x-request-id']);
  });

  it('keeps the id out of code running outside the request', () => {
    run('trace-123');

    expect(RequestContext.getRequestId()).toBeUndefined();
  });
});
