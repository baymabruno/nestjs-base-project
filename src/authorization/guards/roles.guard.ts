import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum.js';
import { Roles } from '../decorators/roles.decorator.js';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!user) {
      throw new UnauthorizedException();
    }

    // Admin accounts bypass role verification
    if (
      user.roles.includes(Role.Admin) ||
      user.roles.some((role) => roles.includes(role))
    ) {
      return true;
    }

    throw new ForbiddenException('not authorized');
  }
}
