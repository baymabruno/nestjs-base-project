import { Injectable } from '@nestjs/common';
import { rolesConstants } from './constants/user.constants';

export type User = any;

@Injectable()
export class UsersService {
  private readonly users = [
    {
      userId: '1',
      username: 'bayma',
      password: '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba', //teste
      roles: [rolesConstants.admin],
    },
    {
      userId: '2',
      username: 'maria',
      password: '$2b$10$y9NEfA5/Byz.YVo4htUvcu4HAsUAtj4uJ5Fo/dH0BFBgqUU.Rq4Ba', //teste
      roles: [rolesConstants.gest],
    },
  ];

  // encrypt password
  // console.log(bcrypt.hashSync(pass, 10));

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }
}
