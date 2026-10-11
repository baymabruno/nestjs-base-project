import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

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
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username, password });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => expect(res.text).toContain('Hello World!'));
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect({ success: '200' });
  });

  it('sets security headers', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect('x-content-type-options', 'nosniff')
      .expect((res) =>
        expect(res.headers['content-security-policy']).toBeDefined(),
      );
  });

  it('generates a request id', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect((res) =>
        expect(res.headers['x-request-id']).toMatch(/^[\w-]{36}$/),
      );
  });

  it('reuses a valid request id', () => {
    return request(app.getHttpServer())
      .get('/api')
      .set('X-Request-Id', 'trace-123')
      .expect('x-request-id', 'trace-123');
  });

  it('returns errors in the standard format', () => {
    return request(app.getHttpServer())
      .get('/not-found')
      .set('X-Request-Id', 'trace-404')
      .expect(404)
      .expect((res) =>
        expect(res.body).toMatchObject({
          statusCode: 404,
          error: 'Not Found',
          path: '/not-found',
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
    it('returns an access token for valid credentials', async () => {
      const res = await login('bayma').expect(200);
      expect(res.body.access_token).toEqual(expect.any(String));
    });

    it('rejects invalid credentials', () => {
      return login('bayma', 'wrong').expect(401);
    });

    it('validates the login body', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);
    });

    it('rejects unknown body properties', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
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

    it('returns the profile of an allowed user', async () => {
      const { body } = await login('bayma');

      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .auth(body.access_token, { type: 'bearer' })
        .expect(200)
        .expect({ userId: '1', username: 'bayma', roles: ['admin'] });
    });

    it('rejects requests without a token', () => {
      return request(app.getHttpServer()).get('/api/auth/profile').expect(401);
    });

    it('rejects an invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .auth('abc.def.ghi', { type: 'bearer' })
        .expect(401);
    });

    it('forbids users without the required role', async () => {
      const { body } = await login('maria');

      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .auth(body.access_token, { type: 'bearer' })
        .expect(403);
    });
  });
});
