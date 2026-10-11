import { Injectable } from '@nestjs/common';

// failed logins allowed per username, from any IP, before it is blocked
export const MAX_FAILED_LOGINS = 10;
// the count starts at the first failure; the block ends when it expires
export const FAILED_LOGINS_WINDOW_MS = 15 * 60 * 1000;
// bounds the memory used by attempts with random usernames
const MAX_TRACKED_USERNAMES = 10_000;

interface FailedLogins {
  count: number;
  expiresAt: number;
}

/**
 * Counts failed logins per username (in memory, per process). Only failures
 * count and a successful login clears them, so a user is not blocked for
 * logging in often, and nobody can lock an account just by guessing.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly failures = new Map<string, FailedLogins>();

  isBlocked(username: string): boolean {
    return (
      (this.current(this.keyOf(username))?.count ?? 0) >= MAX_FAILED_LOGINS
    );
  }

  registerFailure(username: string): void {
    const key = this.keyOf(username);
    const entry = this.current(key) ?? {
      count: 0,
      expiresAt: Date.now() + FAILED_LOGINS_WINDOW_MS,
    };

    entry.count++;
    this.failures.set(key, entry);
    this.prune();
  }

  reset(username: string): void {
    this.failures.delete(this.keyOf(username));
  }

  private keyOf(username: string): string {
    return username.trim().toLowerCase();
  }

  private current(key: string): FailedLogins | undefined {
    const entry = this.failures.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      this.failures.delete(key);
      return undefined;
    }
    return entry;
  }

  private prune(): void {
    if (this.failures.size <= MAX_TRACKED_USERNAMES) {
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.failures) {
      if (entry.expiresAt <= now) this.failures.delete(key);
    }
    // still too many: drop the oldest (a Map keeps insertion order)
    for (const key of this.failures.keys()) {
      if (this.failures.size <= MAX_TRACKED_USERNAMES) break;
      this.failures.delete(key);
    }
  }
}
