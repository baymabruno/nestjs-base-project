import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../users/enums/role.enum';
import { AuthorizationService } from './authorization.service';
import { Authorize } from './decorators/authorize.decorator';
import { LoginResponse } from './dto/login-response.dto';
import { UserLogged } from './dto/user-logged.dto';
import { UserLogin } from './dto/user-login.dto';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@ApiTags('Authorization')
@Controller('api/auth')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('/login')
  @HttpCode(200)
  // stricter limit to slow down password guessing
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({ description: 'Authorization token', type: LoginResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(@Body() credentials: UserLogin): Promise<LoginResponse> {
    return this.authorizationService.login(credentials);
  }

  @Get('/profile')
  @Authorize(Role.Admin)
  @ApiOkResponse({ description: 'Logged user', type: UserLogged })
  getProfile(@Req() req: { user: AuthenticatedUser }): UserLogged {
    return req.user;
  }
}
