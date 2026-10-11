import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { LoginResponse } from './dto/login-response.dto';
import { UserLogin } from './dto/user-login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Compared when the user does not exist, so the response takes the same time
// as a wrong password and does not reveal which usernames exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomUUID(), 10);

@Injectable()
export class AuthorizationService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(credentials: UserLogin): Promise<LoginResponse> {
    const user = await this.validateUser(
      credentials.username,
      credentials.password,
    );

    const payload: JwtPayload = {
      username: user.username,
      userId: user.userId,
    };

    return { access_token: await this.jwtService.signAsync(payload) };
  }

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.findOne(username);
    const passwordMatches = await bcrypt.compare(
      pass,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (user && passwordMatches) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }

    throw new UnauthorizedException('access denied');
  }
}
