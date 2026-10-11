import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
import { JwksController } from './jwks.controller.js';
import { JwksService } from './jwks.service.js';
import { jwtModuleOptions } from './jwt-options.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
    UsersModule,
  ],
  providers: [AuthorizationService, JwtStrategy, JwksService],
  exports: [AuthorizationService],
  controllers: [AuthorizationController, JwksController],
})
export class AuthModule {}
