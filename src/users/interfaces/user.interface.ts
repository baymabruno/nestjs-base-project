import { Role } from '../enums/role.enum';

export interface User {
  userId: string;
  username: string;
  password: string;
  roles: Role[];
}
