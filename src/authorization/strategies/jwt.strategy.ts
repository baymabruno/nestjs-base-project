import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export class ValidatePayalod {
  userId: string;
  username: string;
  roles: [string];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_KEY'),
    });
  }

  async validate(payload: ValidatePayalod): Promise<ValidatePayalod> {
    const user = await this.usersService.findOne(payload.username);

    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles,
    };
  }
}
