import { Role } from '../../users/enums/role.enum';

export interface JwtPayload {
  userId: string;
  username: string;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  roles: Role[];
}
