import { Role } from '../enums/role.enum.js';

export interface User {
  userId: string;
  username: string;
  password: string;
  roles: Role[];
}
