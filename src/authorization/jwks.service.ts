import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, type webcrypto } from 'crypto';
import { Env } from '../config/env.validation.js';

export interface Jwks {
  keys: (webcrypto.JsonWebKey & { kid: string; alg: 'RS256'; use: 'sig' })[];
}

/** RFC 7638 thumbprint: identifies the key, so it can be rotated later */
export const keyIdOf = (publicKeyPem: string): string => {
  const jwk = createPublicKey(publicKeyPem).export({ format: 'jwk' });
  return createHash('sha256')
    .update(JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n }))
    .digest('base64url');
};

/**
 * Publishes the public key that validates the tokens (JWKS), so other
 * services can verify them without access to the private key.
 */
@Injectable()
export class JwksService {
  private readonly jwks: Jwks;

  constructor(config: ConfigService<Env, true>) {
    const publicKey = config.get('JWT_PUBLIC_KEY', { infer: true });
    const jwk = createPublicKey(publicKey).export({ format: 'jwk' });

    this.jwks = {
      keys: [{ ...jwk, kid: keyIdOf(publicKey), alg: 'RS256', use: 'sig' }],
    };
  }

  getJwks(): Jwks {
    return this.jwks;
  }
}
