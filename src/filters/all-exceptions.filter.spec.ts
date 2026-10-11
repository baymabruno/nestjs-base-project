import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

const hostFor = (requestId?: string) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const req = {
    method: 'GET',
    originalUrl: '/test',
    headers: requestId ? { 'x-request-id': requestId } : {},
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;

  return { host, res };
};

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('formats HTTP exceptions', () => {
    const { host, res } = hostFor('abc');
    filter.catch(new NotFoundException('user not found'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'user not found',
        path: '/test',
        requestId: 'abc',
        timestamp: expect.any(String),
      }),
    );
  });

  it('keeps validation messages', () => {
    const { host, res } = hostFor();
    filter.catch(new BadRequestException(['name should not be empty']), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ['name should not be empty'] }),
    );
  });

  it('hides unexpected errors and logs them', () => {
    const { host, res } = hostFor();
    filter.catch(new Error('database password is wrong'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
