import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UsersService } from 'src/users/users.service';
import { UserLogin } from './dto/user-login.dto';

@Injectable()
export class AuthorizationService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(user: UserLogin): Promise<string> {
    const loggedUser = await this.validateUser(user.username, user.password);

    const payload = {
      username: loggedUser.username,
      userId: loggedUser.userId,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(username: string, pass: string): Promise<User> {
    // get user
    const user = await this.usersService.findOne(username);

    // check password
    if (user && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }

    throw new UnauthorizedException('access denied', {
      cause: new Error(),
      description: 'unauthorized',
    });
  }
}
