import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RolesGuard } from './roles.guard';

const contextFor = (user?: AuthenticatedUser) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const userWith = (...roles: Role[]): AuthenticatedUser => ({
  userId: '1',
  username: 'user',
  roles,
});

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const requireRoles = (roles: Role[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows routes without required roles', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('rejects requests without an authenticated user', () => {
    requireRoles([Role.Gest]);
    expect(() => guard.canActivate(contextFor())).toThrow(
      UnauthorizedException,
    );
  });

  it('allows users with a required role', () => {
    requireRoles([Role.Gest]);
    expect(guard.canActivate(contextFor(userWith(Role.Gest)))).toBe(true);
  });

  it('allows admins on any protected route', () => {
    requireRoles([Role.Gest]);
    expect(guard.canActivate(contextFor(userWith(Role.Admin)))).toBe(true);
  });

  it('forbids users without a required role', () => {
    requireRoles([Role.Admin]);
    expect(() => guard.canActivate(contextFor(userWith(Role.Gest)))).toThrow(
      ForbiddenException,
    );
  });
});
