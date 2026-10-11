import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  InjectThrottlerStorage,
  ThrottlerException,
  type ThrottlerStorage,
} from '@nestjs/throttler';

// login attempts allowed per username, from any IP, in the window below
export const LOGIN_ATTEMPTS_PER_USER = 10;
export const LOGIN_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;

/**
 * Limits login attempts per username, complementing the limit per IP, so
 * guessing the password of one account from many IPs is also slowed down.
 */
@Injectable()
export class LoginAttemptsGuard implements CanActivate {
  constructor(@InjectThrottlerStorage() private storage: ThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { body } = context
      .switchToHttp()
      .getRequest<{ body?: { username?: unknown } }>();
    if (typeof body?.username !== 'string') {
      return true; // the body validation rejects the request
    }

    const { isBlocked } = await this.storage.increment(
      `login:${body.username.trim().toLowerCase()}`,
      LOGIN_ATTEMPTS_WINDOW_MS,
      LOGIN_ATTEMPTS_PER_USER,
      LOGIN_ATTEMPTS_WINDOW_MS,
      'login-user',
    );
    if (isBlocked) {
      throw new ThrottlerException('Too many login attempts for this user');
    }
    return true;
  }
}
