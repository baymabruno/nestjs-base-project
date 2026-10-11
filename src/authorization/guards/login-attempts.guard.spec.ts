import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import {
  LOGIN_ATTEMPTS_PER_USER,
  LOGIN_ATTEMPTS_WINDOW_MS,
  LoginAttemptsGuard,
} from './login-attempts.guard.js';

const contextWithBody = (body: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  }) as unknown as ExecutionContext;

describe('LoginAttemptsGuard', () => {
  const increment = vi.fn();
  const guard = new LoginAttemptsGuard({ increment } as ThrottlerStorage);

  beforeEach(() => {
    increment.mockReset();
    increment.mockResolvedValue({ isBlocked: false });
  });

  it('counts the attempt by the normalized username', async () => {
    await expect(
      guard.canActivate(contextWithBody({ username: '  Bayma ' })),
    ).resolves.toBe(true);

    expect(increment).toHaveBeenCalledWith(
      'login:bayma',
      LOGIN_ATTEMPTS_WINDOW_MS,
      LOGIN_ATTEMPTS_PER_USER,
      LOGIN_ATTEMPTS_WINDOW_MS,
      'login-user',
    );
  });

  it('rejects the attempt when the username is blocked', async () => {
    increment.mockResolvedValue({ isBlocked: true });

    await expect(
      guard.canActivate(contextWithBody({ username: 'bayma' })),
    ).rejects.toThrow(ThrottlerException);
  });

  it.each([undefined, {}, { username: 123 }])(
    'leaves an invalid body to the validation (%j)',
    async (body) => {
      await expect(guard.canActivate(contextWithBody(body))).resolves.toBe(
        true,
      );
      expect(increment).not.toHaveBeenCalled();
    },
  );
});
