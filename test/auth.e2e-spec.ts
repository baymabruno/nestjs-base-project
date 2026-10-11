import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createPublicKey } from 'crypto';
import request from 'supertest';
import { createTestApp } from './support/app.js';

// Login, tokens, JWKS, login limits and route protection.
// The tests simulate a reverse proxy (X-Forwarded-For), see setup-env.ts.
describe('Authorization (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (username: string, password = 'teste', ip = '203.0.113.1') =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username, password });

  const profile = (token?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/auth/profile');
    return token ? req.auth(token, { type: 'bearer' }) : req;
  };

  describe('login', () => {
    it('returns access and refresh tokens for valid credentials', async () => {
      const res = await login('bayma').expect(200);

      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: expect.any(Number),
      });
    });

    it('rejects invalid credentials', () => {
      return login('bayma', 'wrong').expect(401);
    });

    it('validates the login body', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });

    it('rejects unknown body properties', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'bayma', password: 'teste', admin: true })
        .expect(400);
    });
  });

  describe('tokens', () => {
    it('exchanges a refresh token for new tokens', async () => {
      const { body } = await login('bayma');

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: body.refresh_token })
        .expect(200);

      await profile(res.body.access_token).expect(200);
    });

    it('does not accept a refresh token as access token', async () => {
      const { body } = await login('bayma');

      return profile(body.refresh_token).expect(401);
    });

    it('does not accept an access token as refresh token', async () => {
      const { body } = await login('bayma');

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: body.access_token })
        .expect(401);
    });

    it('publishes the public key (JWKS) that validates the tokens', async () => {
      const { body: tokens } = await login('bayma');
      const { body: jwks } = await request(app.getHttpServer())
        .get('/.well-known/jwks.json')
        .expect(200)
        .expect('cache-control', 'public, max-age=3600');

      // what another service does to validate a token
      const [jwk] = jwks.keys;
      const publicKey = createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem',
      });
      const payload = new JwtService().verify(tokens.access_token, {
        publicKey,
        algorithms: [jwk.alg],
        issuer: 'e2e-issuer',
        audience: 'e2e-audience',
      });

      expect(jwk).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
      expect(jwk).not.toHaveProperty('d'); // no private key data
      expect(payload).toMatchObject({ sub: '1', username: 'bayma' });
    });
  });

  describe('login limits', () => {
    it('limits login attempts per IP', async () => {
      for (let i = 0; i < 5; i++) {
        await login('bayma', 'wrong').expect(401);
      }
      await login('bayma', 'wrong').expect(429);
    });

    it('counts each client IP separately behind a proxy', async () => {
      for (let i = 0; i < 5; i++) {
        await login('bayma', 'wrong', '203.0.113.10').expect(401);
      }
      await login('bayma', 'wrong', '203.0.113.10').expect(429);
      await login('bayma', 'wrong', '203.0.113.20').expect(401);
    });

    it('blocks a username after 10 failed logins, from any IP', async () => {
      for (let i = 0; i < 10; i++) {
        await login('maria', 'wrong', `198.51.100.${i}`).expect(401);
      }
      // blocked even with the right password
      await login('maria', 'teste', '198.51.100.99').expect(429);
      await login('bayma', 'wrong', '198.51.100.99').expect(401);
    });

    it('does not count successful logins', async () => {
      for (let i = 0; i < 12; i++) {
        await login('bayma', 'teste', `198.51.100.${i}`).expect(200);
      }
    });

    it('clears the failed logins after a successful login', async () => {
      for (let i = 0; i < 9; i++) {
        await login('maria', 'wrong', `198.51.100.${i}`).expect(401);
      }
      await login('maria', 'teste', '198.51.100.50').expect(200);
      for (let i = 0; i < 9; i++) {
        await login('maria', 'wrong', `198.51.100.${100 + i}`).expect(401);
      }
    });
  });

  describe('route protection', () => {
    it('returns the profile of an allowed user', async () => {
      const { body } = await login('bayma');

      return profile(body.access_token)
        .expect(200)
        .expect({ userId: '1', username: 'bayma', roles: ['admin'] });
    });

    it('rejects requests without a token', () => {
      return profile().expect(401);
    });

    it('rejects an invalid token', () => {
      return profile('abc.def.ghi').expect(401);
    });

    it('forbids users without the required role', async () => {
      const { body } = await login('maria');

      return profile(body.access_token).expect(403);
    });
  });
});
