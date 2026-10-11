import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { generateJwtKeys } from '../../test/support/jwt-keys.js';
import { Env, envSchema } from '../config/env.validation.js';
import { Role } from '../users/enums/role.enum.js';
import { UsersService } from '../users/users.service.js';
import { AuthorizationService } from './authorization.service.js';
import { jwtModuleOptions } from './jwt-options.js';

// real bcrypt, with compare observable by the tests
vi.mock('bcrypt', async (importOriginal) => {
  const { default: actual } = await importOriginal<{
    default: typeof import('bcrypt');
  }>();
  return { default: { ...actual, compare: vi.fn(actual.compare) } };
});

// bcrypt hash of "teste"
const PASSWORD_HASH =
  '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba';

const config = new ConfigService(
  envSchema.parse({ ...generateJwtKeys(), JWT_EXPIRES_IN: '900' }),
) as ConfigService<Env, true>;
const jwtService = new JwtService(jwtModuleOptions(config));

const USER = {
  userId: '1',
  username: 'bayma',
  password: PASSWORD_HASH,
  roles: [Role.Admin],
};

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  const findOne = vi.fn();

  beforeEach(async () => {
    findOne.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: UsersService, useValue: { findOne } },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(AuthorizationService);
  });

  it('returns access and refresh tokens for valid credentials', async () => {
    findOne.mockResolvedValue(USER);

    const tokens = await service.login({
      username: 'bayma',
      password: 'teste',
    });

    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 900 });
    expect(jwtService.verify(tokens.access_token)).toMatchObject({
      sub: '1',
      username: 'bayma',
      token_use: 'access',
      iss: 'nestjs-base-project',
      aud: 'nestjs-base-project',
    });
    expect(jwtService.verify(tokens.refresh_token)).toMatchObject({
      token_use: 'refresh',
      jti: expect.any(String),
    });
  });

  it('signs the tokens with RS256 and the key id', async () => {
    findOne.mockResolvedValue(USER);

    const { access_token } = await service.login({
      username: 'bayma',
      password: 'teste',
    });
    const header = jwtService.decode(access_token, { complete: true }).header;

    expect(header).toMatchObject({ alg: 'RS256', kid: expect.any(String) });
  });

  it('exchanges a refresh token for new tokens', async () => {
    findOne.mockResolvedValue(USER);
    const { refresh_token } = await service.login({
      username: 'bayma',
      password: 'teste',
    });

    const tokens = await service.refresh(refresh_token);

    expect(jwtService.verify(tokens.access_token).token_use).toBe('access');
  });

  it('does not accept an access token as refresh token', async () => {
    findOne.mockResolvedValue(USER);
    const { access_token } = await service.login({
      username: 'bayma',
      password: 'teste',
    });

    await expect(service.refresh(access_token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token of a user that no longer exists', async () => {
    findOne.mockResolvedValue(USER);
    const { refresh_token } = await service.login({
      username: 'bayma',
      password: 'teste',
    });
    findOne.mockResolvedValue(undefined);

    await expect(service.refresh(refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid refresh token', async () => {
    await expect(service.refresh('abc.def.ghi')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('does not expose the password hash', async () => {
    findOne.mockResolvedValue(USER);

    const user = await service.validateUser('bayma', 'teste');
    expect(user).not.toHaveProperty('password');
  });

  it('rejects a wrong password', async () => {
    findOne.mockResolvedValue(USER);

    await expect(service.validateUser('bayma', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown user', async () => {
    findOne.mockResolvedValue(undefined);

    await expect(service.validateUser('nobody', 'teste')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('checks a password even for unknown users, to keep the same timing', async () => {
    findOne.mockResolvedValue(undefined);
    vi.mocked(bcrypt.compare).mockClear();

    await expect(service.validateUser('nobody', 'teste')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });
});
