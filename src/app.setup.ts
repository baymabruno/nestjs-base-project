import {
  RequestMethod,
  StandardSchemaValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { Env } from './config/env.validation.js';

/**
 * Shared application setup, used by main.ts and the e2e tests so both run
 * with the same pipes, security headers and view engine.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Needed behind a reverse proxy / load balancer, so req.ip (used by the
  // rate limit and the logs) is the client IP and not the proxy IP
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : '*',
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
    allowedHeaders:
      'Content-Type, Authorization, X-Requested-With, X-Request-Id',
    exposedHeaders: 'X-Request-Id',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  // API routes live under /api/v1 (/api/v2 when a breaking version is added).
  // The home page and the health check stay at / and /health.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
      { path: '.well-known/jwks.json', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // validates the parameters declared with a schema, e.g. @Body({ schema })
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  app.setBaseViewsDir(join(import.meta.dirname, '..', 'views'));
  app.setViewEngine('hbs');

  if (config.get('SWAGGER', { infer: true })) {
    const options = new DocumentBuilder()
      .addBearerAuth()
      .setTitle('Nest Base Project')
      .setDescription('Projeto base Node.Js - NestJs')
      .setVersion('1.0')
      .build();

    SwaggerModule.setup('/doc', app, () =>
      SwaggerModule.createDocument(app, options),
    );
  }

  app.enableShutdownHooks();
}
