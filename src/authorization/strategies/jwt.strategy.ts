import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Env } from '../../config/env.validation.js';
import { UsersService } from '../../users/users.service.js';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_PUBLIC_KEY', { infer: true }),
      algorithms: ['RS256'],
      issuer: config.get('JWT_ISSUER', { infer: true }),
      audience: config.get('JWT_AUDIENCE', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // a refresh token is not accepted as an access token
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findOne(payload.username);
    if (!user || user.userId !== payload.sub) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles,
    };
  }
}
