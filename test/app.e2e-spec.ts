import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { createPublicKey } from 'crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (username: string, password = 'teste', ip = '203.0.113.1') =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username, password });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => expect(res.text).toContain('Hello World!'));
  });

  it('/api/v1/status (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/status')
      .expect(200)
      .expect({ success: '200' });
  });

  it('sets security headers', () => {
    return request(app.getHttpServer())
      .get('/api/v1/status')
      .expect('x-content-type-options', 'nosniff')
      .expect((res) =>
        expect(res.headers['content-security-policy']).toBeDefined(),
      );
  });

  it('generates a request id', () => {
    return request(app.getHttpServer())
      .get('/api/v1/status')
      .expect((res) =>
        expect(res.headers['x-request-id']).toMatch(/^[\w-]{36}$/),
      );
  });

  it('reuses a valid request id', () => {
    return request(app.getHttpServer())
      .get('/api/v1/status')
      .set('X-Request-Id', 'trace-123')
      .expect('x-request-id', 'trace-123');
  });

  it('serves the API only under /api/v1', () => {
    return request(app.getHttpServer()).get('/api/status').expect(404);
  });

  it.each(['/', '/health'])(
    'adds a request id outside the API prefix (%s)',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .expect((res) => expect(res.headers['x-request-id']).toBeDefined());
    },
  );

  it('returns errors in the standard format', () => {
    return request(app.getHttpServer())
      .get('/api/v1/not-found')
      .set('X-Request-Id', 'trace-404')
      .expect(404)
      .expect((res) =>
        expect(res.body).toMatchObject({
          statusCode: 404,
          error: 'Not Found',
          path: '/api/v1/not-found',
          requestId: 'trace-404',
        }),
      );
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  describe('authorization', () => {
    it('returns access and refresh tokens for valid credentials', async () => {
      const res = await login('bayma').expect(200);
      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: expect.any(Number),
      });
    });

    it('exchanges a refresh token for new tokens', async () => {
      const { body } = await login('bayma');

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: body.refresh_token })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .auth(res.body.access_token, { type: 'bearer' })
        .expect(200);
    });

    it('does not accept a refresh token as access token', async () => {
      const { body } = await login('bayma');

      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .auth(body.refresh_token, { type: 'bearer' })
        .expect(401);
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
        .expect(200);

      // what another service does to validate a token
      const [jwk] = jwks.keys;
      const publicKey = createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem',
      });
      const payload = new JwtService().verify(tokens.access_token, {
        publicKey,
        algorithms: [jwk.alg],
        issuer: 'nestjs-base-project',
        audience: 'nestjs-base-project',
      });

      expect(jwk).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
      expect(jwk).not.toHaveProperty('d'); // no private key data
      expect(payload).toMatchObject({ sub: '1', username: 'bayma' });
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

    it('limits login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await login('bayma', 'wrong').expect(401);
      }
      await login('bayma', 'wrong').expect(429);
    });

    it('limits login attempts per client IP behind a proxy', async () => {
      for (let i = 0; i < 5; i++) {
        await login('bayma', 'wrong', '203.0.113.10').expect(401);
      }
      await login('bayma', 'wrong', '203.0.113.10').expect(429);
      await login('bayma', 'wrong', '203.0.113.20').expect(401);
    });

    it('limits login attempts per username, from any IP', async () => {
      for (let i = 0; i < 10; i++) {
        await login('maria', 'wrong', `198.51.100.${i}`).expect(401);
      }
      await login('maria', 'wrong', '198.51.100.99').expect(429);
      await login('bayma', 'wrong', '198.51.100.99').expect(401);
    });

    it('returns the profile of an allowed user', async () => {
      const { body } = await login('bayma');

      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .auth(body.access_token, { type: 'bearer' })
        .expect(200)
        .expect({ userId: '1', username: 'bayma', roles: ['admin'] });
    });

    it('rejects requests without a token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('rejects an invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .auth('abc.def.ghi', { type: 'bearer' })
        .expect(401);
    });

    it('forbids users without the required role', async () => {
      const { body } = await login('maria');

      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .auth(body.access_token, { type: 'bearer' })
        .expect(403);
    });
  });
});
