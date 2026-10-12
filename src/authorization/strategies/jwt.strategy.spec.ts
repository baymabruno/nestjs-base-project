import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requiredEnv } from '../../../test/support/env.js';
import { Env, envSchema } from '../../config/env.validation.js';
import { Role } from '../../users/enums/role.enum.js';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const findOne = vi.fn();
  const config = new ConfigService(
    envSchema.parse({ ...requiredEnv(), JWT_EXPIRES_IN: '900' }),
  ) as ConfigService<Env, true>;
  const strategy = new JwtStrategy(config, {
    findOne,
  } as unknown as UsersService);

  const payload: JwtPayload = {
    sub: '1',
    username: 'bayma',
    token_use: 'access',
  };

  beforeEach(() => {
    findOne.mockReset();
    findOne.mockResolvedValue({
      userId: '1',
      username: 'bayma',
      password: 'hash',
      roles: [Role.Admin],
    });
  });

  it('returns the user of a valid access token, without the password', async () => {
    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: '1',
      username: 'bayma',
      roles: [Role.Admin],
    });
  });

  it('rejects a refresh token', async () => {
    await expect(
      strategy.validate({ ...payload, token_use: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token of a user that no longer exists', async () => {
    findOne.mockResolvedValue(undefined);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose user id does not match the username', async () => {
    await expect(strategy.validate({ ...payload, sub: '2' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
