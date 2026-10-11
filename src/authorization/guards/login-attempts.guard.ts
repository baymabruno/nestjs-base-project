import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { LoginAttemptsService } from '../login-attempts.service.js';

/**
 * Rejects the login of a username blocked by too many failed attempts,
 * complementing the limit per IP, so guessing the password of one account
 * from many IPs is also stopped.
 */
@Injectable()
export class LoginAttemptsGuard implements CanActivate {
  constructor(private readonly loginAttempts: LoginAttemptsService) {}

  canActivate(context: ExecutionContext): boolean {
    const { body } = context
      .switchToHttp()
      .getRequest<{ body?: { username?: unknown } }>();
    if (typeof body?.username !== 'string') {
      return true; // the body validation rejects the request
    }

    if (this.loginAttempts.isBlocked(body.username)) {
      throw new ThrottlerException('Too many failed logins for this user');
    }
    return true;
  }
}
