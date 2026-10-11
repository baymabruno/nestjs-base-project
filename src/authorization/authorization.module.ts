import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_KEY'),
        signOptions: {
          expiresIn: parseInt(
            configService.getOrThrow<string>('JWT_EXPIRES_IN'),
          ),
        },
      }),
    }),
    UsersModule,
  ],
  providers: [AuthorizationService, JwtStrategy],
  exports: [AuthorizationService, JwtModule],
  controllers: [AuthorizationController],
})
export class AuthModule {}
