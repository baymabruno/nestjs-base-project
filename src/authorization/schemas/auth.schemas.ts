import { z } from 'zod';
import { Role } from '../../users/enums/role.enum.js';

// Request and response schemas: they validate the requests
// (StandardSchemaValidationPipe) and generate the Swagger documentation

export const loginSchema = z
  .strictObject({
    username: z.string().trim().min(1).max(100),
    // bcrypt only uses the first 72 bytes of the password
    password: z.string().min(1).max(72),
  })
  .meta({ id: 'UserLogin' });

export const refreshTokenSchema = z
  .strictObject({
    refresh_token: z.jwt(),
  })
  .meta({ id: 'RefreshToken' });

export const loginResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal('Bearer'),
    expires_in: z.number().describe('Access token lifetime in seconds'),
  })
  .meta({ id: 'LoginResponse' });

export const userLoggedSchema = z
  .object({
    userId: z.string(),
    username: z.string(),
    roles: z.array(z.enum(Role)),
  })
  .meta({ id: 'UserLogged' });

export type UserLogin = z.infer<typeof loginSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type UserLogged = z.infer<typeof userLoggedSchema>;
