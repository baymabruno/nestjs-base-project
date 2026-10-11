import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { rolesConstants } from '../../users/constants/user.constants';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AuthorizeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();

    if (!request.headers.authorization) {
      throw new UnauthorizedException('invalid authorization', {
        cause: new Error(),
        description: 'unauthorized',
      });
    }

    // Bearer xxx.yyy.zzz
    const authHeaderValue = request.headers.authorization;

    //Authorization header is not of type 'Bearer',
    if (!authHeaderValue.startsWith('Bearer')) {
      throw new UnauthorizedException('invalid authorization', {
        cause: new Error(),
        description: 'unauthorized',
      });
    }

    //split the string into 2 parts : 'Bearer ' and the `xxx.yyy.zzz`
    const parts = authHeaderValue.split(' ');

    if (parts.length !== 2) {
      throw new UnauthorizedException('invalid authorization', {
        cause: new Error(),
        description: 'unauthorized',
      });
    }
    const token = parts[1];

    let decryptedToken: any;
    try {
      decryptedToken = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Authorization error', {
        cause: new Error(),
        description: 'unauthorized',
      });
    }

    const user: any = await this.usersService.findOne(decryptedToken.username);

    // Admin and support accounts bypass id verification
    if (user.roles.includes(rolesConstants.admin)) {
      return true;
    }

    // Check user role and rote allowed Roles
    for (const userRole of user.roles) {
      if (roles.includes(userRole)) {
        return true;
      }
    }

    throw new UnauthorizedException('not authorized', {
      cause: new Error(),
      description: 'unauthorized',
    });
  }
}
