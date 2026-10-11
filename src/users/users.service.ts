import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env, isProduction } from '../config/env.validation.js';
import { Role } from './enums/role.enum.js';
import { User } from './interfaces/user.interface.js';

// Demo users (password: "teste"), only available outside production.
// Replace this in-memory store with a real persistence layer.
// To hash a new password: bcrypt.hashSync(password, 10)
const DEMO_USERS: User[] = [
  {
    userId: '1',
    username: 'bayma',
    password: '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba',
    roles: [Role.Admin],
  },
  {
    userId: '2',
    username: 'maria',
    password: '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba',
    roles: [Role.Gest],
  },
];

@Injectable()
export class UsersService {
  private readonly users: User[];

  constructor(config: ConfigService<Env, true>) {
    this.users = isProduction(config.get('APP_ENVIRONMENT', { infer: true }))
      ? []
      : DEMO_USERS;
  }

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }
}
