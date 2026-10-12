import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'crypto';
import { requiredEnv } from '../../test/support/env.js';
import { Env, envSchema } from '../config/env.validation.js';
import { JwksService, keyIdOf } from './jwks.service.js';

describe('keyIdOf', () => {
  it('computes the RFC 7638 thumbprint', () => {
    // example key and expected thumbprint from RFC 7638, section 3.1
    const rfcKey = {
      kty: 'RSA',
      e: 'AQAB',
      n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
    } as const;
    const pem = createPublicKey({ key: rfcKey, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();

    expect(keyIdOf(pem)).toBe('NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs');
  });
});

describe('JwksService', () => {
  const env = envSchema.parse({ ...requiredEnv(), JWT_EXPIRES_IN: '900' });
  const service = new JwksService(
    new ConfigService(env) as ConfigService<Env, true>,
  );

  it('publishes the public key with its id, algorithm and use', () => {
    const [key] = service.getJwks().keys;

    expect(key).toMatchObject({
      kty: 'RSA',
      kid: keyIdOf(env.JWT_PUBLIC_KEY),
      alg: 'RS256',
      use: 'sig',
      e: expect.any(String),
      n: expect.any(String),
    });
  });

  it('never publishes private key data', () => {
    const [key] = service.getJwks().keys;

    for (const privateField of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(privateField);
    }
  });
});
