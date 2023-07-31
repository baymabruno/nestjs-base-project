import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from 'src/users/users.service';
import { jwtConstants } from '../constants/authorization.constants';

export class ValidatePayalod {
  userId: string;
  username: string;
  roles: [string];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: ValidatePayalod): Promise<ValidatePayalod> {
    const user = await new UsersService().findOne(payload.username);

    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles,
    };
  }
}
