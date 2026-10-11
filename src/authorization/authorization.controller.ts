import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../users/enums/role.enum.js';
import { AuthorizationService } from './authorization.service.js';
import { Authorize } from './decorators/authorize.decorator.js';
import { LoginAttemptsGuard } from './guards/login-attempts.guard.js';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface.js';
import {
  loginResponseSchema,
  loginSchema,
  refreshTokenSchema,
  userLoggedSchema,
  type LoginResponse,
  type RefreshToken,
  type UserLogged,
  type UserLogin,
} from './schemas/auth.schemas.js';

@ApiTags('Authorization')
@Controller('auth')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('/login')
  @HttpCode(200)
  // stricter limits against password guessing: requests per IP and failed
  // logins per username
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LoginAttemptsGuard)
  @ApiOkResponse({
    description: 'Access and refresh tokens',
    standardSchema: loginResponseSchema,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(
    @Body({ schema: loginSchema }) credentials: UserLogin,
  ): Promise<LoginResponse> {
    return this.authorizationService.login(credentials);
  }

  @Post('/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({
    description: 'New access and refresh tokens',
    standardSchema: loginResponseSchema,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Body({ schema: refreshTokenSchema }) body: RefreshToken,
  ): Promise<LoginResponse> {
    return this.authorizationService.refresh(body.refresh_token);
  }

  @Get('/profile')
  @Authorize(Role.Admin)
  @ApiOkResponse({
    description: 'Logged user',
    standardSchema: userLoggedSchema,
  })
  getProfile(@Req() req: { user: AuthenticatedUser }): UserLogged {
    return req.user;
  }
}
