import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import { Env } from '../config/env.validation.js';
import { keyIdOf } from './jwks.service.js';

/** JWT signing and verification settings (RS256, issuer and audience) */
export const jwtModuleOptions = (
  config: ConfigService<Env, true>,
): JwtModuleOptions => {
  const issuer = config.get('JWT_ISSUER', { infer: true });
  const audience = config.get('JWT_AUDIENCE', { infer: true });
  const publicKey = config.get('JWT_PUBLIC_KEY', { infer: true });

  return {
    privateKey: config.get('JWT_PRIVATE_KEY', { infer: true }),
    publicKey,
    signOptions: {
      algorithm: 'RS256',
      keyid: keyIdOf(publicKey),
      issuer,
      audience,
      expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
    },
    verifyOptions: { algorithms: ['RS256'], issuer, audience },
  };
};
