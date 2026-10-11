import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { UsersService } from './users.service';

const serviceFor = (APP_ENVIRONMENT: string) =>
  new UsersService(
    new ConfigService({ APP_ENVIRONMENT }) as ConfigService<Env, true>,
  );

describe('UsersService', () => {
  it('finds demo users outside production', async () => {
    const user = await serviceFor('develop').findOne('bayma');
    expect(user?.userId).toBe('1');
  });

  it('returns undefined for unknown users', async () => {
    expect(await serviceFor('develop').findOne('nobody')).toBeUndefined();
  });

  it('does not load demo users in production', async () => {
    expect(await serviceFor('production').findOne('bayma')).toBeUndefined();
  });
});
