import { Role } from '../../users/enums/role.enum.js';

export type TokenUse = 'access' | 'refresh';

export interface JwtPayload {
  /** user id */
  sub: string;
  username: string;
  /** keeps a refresh token from being used as an access token and vice versa */
  token_use: TokenUse;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  roles: Role[];
}
