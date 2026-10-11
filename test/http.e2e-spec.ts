import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createTestApp } from './support/app.js';

// Behavior shared by every route: home page, security headers, CORS,
// request id, versioning, error format and health check
describe('HTTP (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) renders the home page with the version', () => {
    const { version } = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    );

    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('content-type', /html/)
      .expect((res) => {
        expect(res.text).toContain('Hello World!');
        expect(res.text).toContain(`Version ${version}`);
      });
  });

  it('allows the Google Fonts used by the home page', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect((res) => {
        const csp = res.headers['content-security-policy'];
        expect(csp).toContain('https://fonts.googleapis.com');
        expect(csp).toContain('https://fonts.gstatic.com');
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  it('sets security headers', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect('x-content-type-options', 'nosniff')
      .expect((res) => {
        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();
        // would make the browser load the Swagger UI files over https
        expect(csp).not.toContain('upgrade-insecure-requests');
      });
  });

  it('allows cross-origin requests and exposes the request id', () => {
    return request(app.getHttpServer())
      .options('/api/v1/auth/profile')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-request-id')
      .expect(204)
      .expect((res) => {
        expect(res.headers['access-control-allow-headers']).toMatch(
          /authorization/i,
        );
        expect(res.headers['access-control-allow-headers']).toMatch(
          /x-request-id/i,
        );
      });
  });

  describe('request id', () => {
    it('generates a request id', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect((res) =>
          expect(res.headers['x-request-id']).toMatch(/^[\w-]{36}$/),
        );
    });

    it('reuses a valid request id', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'trace-123')
        .expect('x-request-id', 'trace-123');
    });

    it('replaces an invalid request id', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'bad id!')
        .expect((res) =>
          expect(res.headers['x-request-id']).toMatch(/^[\w-]{36}$/),
        );
    });
  });

  describe('routes', () => {
    it('serves the API only under /api/v1', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'bayma', password: 'teste' })
        .expect(404);
    });

    it('keeps the home page, the health check and the JWKS outside the API prefix', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer())
        .get('/.well-known/jwks.json')
        .expect(200);
    });
  });

  describe('errors', () => {
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
            timestamp: expect.any(String),
          }),
        );
    });

    it('answers malformed JSON with 400 in the standard format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"username":')
        .expect(400)
        .expect((res) =>
          expect(res.body).toMatchObject({
            statusCode: 400,
            path: '/api/v1/auth/login',
            requestId: expect.any(String),
          }),
        );
    });
  });
});
