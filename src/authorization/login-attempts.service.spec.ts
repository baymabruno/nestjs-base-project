import {
  FAILED_LOGINS_WINDOW_MS,
  LoginAttemptsService,
  MAX_FAILED_LOGINS,
} from './login-attempts.service.js';

describe('LoginAttemptsService', () => {
  let service: LoginAttemptsService;

  const fail = (username: string, times: number) => {
    for (let i = 0; i < times; i++) service.registerFailure(username);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LoginAttemptsService();
  });

  afterEach(() => vi.useRealTimers());

  it('blocks a username after the maximum of failed logins', () => {
    fail('bayma', MAX_FAILED_LOGINS - 1);
    expect(service.isBlocked('bayma')).toBe(false);

    fail('bayma', 1);
    expect(service.isBlocked('bayma')).toBe(true);
  });

  it('counts the username ignoring case and spaces', () => {
    fail(' Bayma ', MAX_FAILED_LOGINS);

    expect(service.isBlocked('bayma')).toBe(true);
  });

  it('does not affect other usernames', () => {
    fail('bayma', MAX_FAILED_LOGINS);

    expect(service.isBlocked('maria')).toBe(false);
  });

  it('clears the failures after a successful login', () => {
    fail('bayma', MAX_FAILED_LOGINS);
    service.reset('bayma');

    expect(service.isBlocked('bayma')).toBe(false);
  });

  it('unblocks when the window expires', () => {
    fail('bayma', MAX_FAILED_LOGINS);

    vi.advanceTimersByTime(FAILED_LOGINS_WINDOW_MS);

    expect(service.isBlocked('bayma')).toBe(false);
  });

  it('starts a new count after the window expires', () => {
    fail('bayma', MAX_FAILED_LOGINS - 1);
    vi.advanceTimersByTime(FAILED_LOGINS_WINDOW_MS);

    fail('bayma', 1);

    expect(service.isBlocked('bayma')).toBe(false);
  });

  it('keeps the memory bounded with many usernames', () => {
    for (let i = 0; i < 10_050; i++) service.registerFailure(`user-${i}`);

    const tracked = (service as unknown as { failures: Map<string, unknown> })
      .failures.size;
    expect(tracked).toBeLessThanOrEqual(10_000);
  });
});
