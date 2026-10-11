import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Env } from '../config/env.validation';
import { UsersModule } from '../users/users.module';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_KEY', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
    UsersModule,
  ],
  providers: [AuthorizationService, JwtStrategy],
  exports: [AuthorizationService],
  controllers: [AuthorizationController],
})
export class AuthModule {}
