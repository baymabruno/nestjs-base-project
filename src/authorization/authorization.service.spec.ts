import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Role } from '../users/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuthorizationService } from './authorization.service';

// real bcrypt, with compare observable by the tests
jest.mock('bcrypt', () => {
  const actual = jest.requireActual('bcrypt');
  return { ...actual, compare: jest.fn(actual.compare) };
});

// bcrypt hash of "teste"
const PASSWORD_HASH =
  '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  const findOne = jest.fn();

  beforeEach(async () => {
    findOne.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: UsersService, useValue: { findOne } },
        { provide: JwtService, useValue: new JwtService({ secret: 'test' }) },
      ],
    }).compile();

    service = moduleRef.get(AuthorizationService);
  });

  it('returns an access token for valid credentials', async () => {
    findOne.mockResolvedValue({
      userId: '1',
      username: 'bayma',
      password: PASSWORD_HASH,
      roles: [Role.Admin],
    });

    const { access_token } = await service.login({
      username: 'bayma',
      password: 'teste',
    });

    const payload = new JwtService({ secret: 'test' }).verify(access_token);
    expect(payload).toMatchObject({ userId: '1', username: 'bayma' });
  });

  it('does not expose the password hash', async () => {
    findOne.mockResolvedValue({
      userId: '1',
      username: 'bayma',
      password: PASSWORD_HASH,
      roles: [Role.Admin],
    });

    const user = await service.validateUser('bayma', 'teste');
    expect(user).not.toHaveProperty('password');
  });

  it('rejects a wrong password', async () => {
    findOne.mockResolvedValue({
      userId: '1',
      username: 'bayma',
      password: PASSWORD_HASH,
      roles: [Role.Admin],
    });

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
    jest.mocked(bcrypt.compare).mockClear();

    await expect(service.validateUser('nobody', 'teste')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });
});
