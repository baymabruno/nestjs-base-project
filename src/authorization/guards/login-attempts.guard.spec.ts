import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { LoginAttemptsGuard } from './login-attempts.guard.js';

const contextWithBody = (body: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  }) as unknown as ExecutionContext;

describe('LoginAttemptsGuard', () => {
  const isBlocked = vi.fn();
  const guard = new LoginAttemptsGuard({
    isBlocked,
  } as unknown as LoginAttemptsService);

  beforeEach(() => {
    isBlocked.mockReset();
    isBlocked.mockReturnValue(false);
  });

  it('allows a username that is not blocked', () => {
    expect(guard.canActivate(contextWithBody({ username: 'bayma' }))).toBe(
      true,
    );
    expect(isBlocked).toHaveBeenCalledWith('bayma');
  });

  it('rejects a blocked username with 429', () => {
    isBlocked.mockReturnValue(true);

    expect(() =>
      guard.canActivate(contextWithBody({ username: 'bayma' })),
    ).toThrow(ThrottlerException);
  });

  it.each([undefined, {}, { username: 123 }])(
    'leaves an invalid body to the validation (%j)',
    (body) => {
      expect(guard.canActivate(contextWithBody(body))).toBe(true);
      expect(isBlocked).not.toHaveBeenCalled();
    },
  );
});
