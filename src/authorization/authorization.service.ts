import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Env } from '../config/env.validation.js';
import { User } from '../users/interfaces/user.interface.js';
import { UsersService } from '../users/users.service.js';
import type { LoginResponse, UserLogin } from './schemas/auth.schemas.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

// Compared when the user does not exist, so the response takes the same time
// as a wrong password and does not reveal which usernames exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomUUID(), 10);

@Injectable()
export class AuthorizationService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService<Env, true>,
  ) {}

  async login(credentials: UserLogin): Promise<LoginResponse> {
    const user = await this.validateUser(
      credentials.username,
      credentials.password,
    );

    return this.issueTokens(user);
  }

  /**
   * Exchanges a valid refresh token for a new pair of tokens. Refresh tokens
   * are stateless JWTs: they work across instances, but cannot be revoked
   * before they expire (that needs a store, e.g. Redis or a database).
   */
  async refresh(refreshToken: string): Promise<LoginResponse> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('invalid refresh token');
    }

    const user =
      payload.token_use === 'refresh'
        ? await this.usersService.findOne(payload.username)
        : undefined;
    if (!user || user.userId !== payload.sub) {
      throw new UnauthorizedException('invalid refresh token');
    }

    return this.issueTokens(user);
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

  private async issueTokens(
    user: Pick<User, 'userId' | 'username'>,
  ): Promise<LoginResponse> {
    const claims = { sub: user.userId, username: user.username };
    const expiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...claims, token_use: 'access' }),
      this.jwtService.signAsync(
        { ...claims, token_use: 'refresh' },
        {
          expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
          jwtid: randomUUID(),
        },
      ),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }
}
