import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createTestApp } from './support/app.js';

// SWAGGER is enabled for the e2e tests in setup-env.ts
describe('Swagger (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const openApi = async () =>
    (await request(app.getHttpServer()).get('/doc-json').expect(200)).body;

  it('serves the documentation page', () => {
    return request(app.getHttpServer())
      .get('/doc')
      .expect(200)
      .expect('content-type', /html/);
  });

  it('documents the versioned routes', async () => {
    const { paths } = await openApi();

    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/profile',
        '/.well-known/jwks.json',
        '/health',
      ]),
    );
  });

  it('leaves the home page out of the documentation', async () => {
    const { paths } = await openApi();

    expect(paths).not.toHaveProperty('/');
  });

  it('documents the bearer authentication of the protected routes', async () => {
    const { components, paths } = await openApi();

    expect(components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: expect.stringContaining('access_token'),
    });
    expect(paths['/api/v1/auth/profile'].get.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('documents the request and response schemas', async () => {
    const { components } = await openApi();

    expect(Object.keys(components.schemas)).toEqual(
      expect.arrayContaining(['UserLogin', 'LoginResponse', 'UserLogged']),
    );
  });

  it('uses the name and version of package.json', async () => {
    const { info } = await openApi();
    const { name, version } = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    );

    expect(info).toMatchObject({ title: name, version });
  });
});
