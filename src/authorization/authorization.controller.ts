import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { rolesConstants } from 'src/users/constants/user.constants';
import { AuthorizationService } from './authorization.service';
import { UserLogged } from './dto/user-logged.dto';
import { UserLogin } from './dto/user-login.dto';
import { Authorize } from './guards/authorize.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authorization')
@Controller('api/auth')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('/login')
  @ApiBody({ type: UserLogin })
  @ApiResponse({
    status: 200,
    description: 'Authorization token',
    type: String,
  })
  async login(@Body() user: UserLogin): Promise<string> {
    return this.authorizationService.login(user);
  }

  @Get('/profile')
  @Authorize(rolesConstants.admin)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Logged user', type: UserLogged })
  getProfile(@Request() req: any): UserLogged {
    return req.user;
  }
}
