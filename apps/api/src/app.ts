import type { HealthResponse } from '@elsa3d/shared-types';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Router } from 'express';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { securityMiddleware } from './middleware/security.js';
import { createApiRouter } from './routes/index.js';
import { openApiDocument } from './openapi.js';

export interface AppOptions {
  checkDatabase: () => Promise<void>;
  authRouter: Router;
  webOrigins: string[];
  apiRouter?: Router;
  uploadDirectory?: string;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(...securityMiddleware);
  app.use(requestLogger);
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || options.webOrigins.includes(origin));
      },
      credentials: true,
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-Auth-Transport',
        'X-CSRF-Token',
        'X-File-Name',
        'X-Image-Alt',
      ],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));
  app.use(
    '/uploads',
    express.static(
      path.resolve(
        options.uploadDirectory ??
          path.join(process.cwd(), 'storage', 'uploads'),
      ),
    ),
  );

  app.get('/api/v1', (_request, response) => {
    response.json({ message: 'Hello from the El-Sa3d API', service: 'api' });
  });

  app.get('/api/v1/health/live', (_request, response) => {
    const body: HealthResponse = {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    response.json(body);
  });

  app.get('/api/v1/health/ready', async (_request, response) => {
    try {
      await options.checkDatabase();
      const body: HealthResponse = {
        service: 'api',
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
      response.json(body);
    } catch {
      const body: HealthResponse = {
        service: 'api',
        status: 'degraded',
        timestamp: new Date().toISOString(),
      };
      response.status(503).json(body);
    }
  });

  app.use('/api/v1', options.apiRouter ?? createApiRouter());

  app.use('/api/v1/auth', options.authRouter);
  app.get('/api/openapi.json', (_request, response) => {
    response.json(openApiDocument);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  app.use(errorHandler);

  return app;
}
