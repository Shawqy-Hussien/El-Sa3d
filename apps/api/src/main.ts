import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseConfig } from '@elsa3d/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { createAuthRouter } from './auth/router.js';
import { createMailer } from './auth/mailer.js';
import {
  ACCESS_COOKIE,
  authenticate,
  isCookieTransport,
  requireCsrf,
  requireRoleAndPermission,
} from './auth/middleware.js';
import { AccountRole } from './generated/prisma/client.js';
import { createApp } from './app.js';
import { PrismaClient } from './generated/prisma/client.js';
import { createApiRouter } from './routes/index.js';
import {
  LocalDiskStorageAdapter,
  S3CompatibleStorageAdapter,
} from './modules/catalog/storage.js';

function resolveProjectEnv(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(currentDir, '.env');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('Could not find a .env file for the project root.');
    }

    currentDir = parentDir;
  }
}

dotenv.config({ path: resolveProjectEnv() });

const config = parseConfig(process.env);
const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const apiAuth = authenticate(prisma, config);
const optionalAuth = (
  request: import('express').Request,
  response: import('express').Response,
  next: import('express').NextFunction,
) => {
  const hasCredential = isCookieTransport(request)
    ? Boolean(request.cookies?.[ACCESS_COOKIE])
    : Boolean(request.get('authorization'));
  if (!hasCredential) return next();
  return apiAuth(request, response, next);
};
const storage =
  config.STORAGE_DRIVER === 's3'
    ? new S3CompatibleStorageAdapter(
        config.S3_ENDPOINT!,
        config.S3_BUCKET!,
        config.S3_REGION,
        config.S3_ACCESS_KEY_ID,
        config.S3_SECRET_ACCESS_KEY,
        config.STORAGE_PUBLIC_URL,
      )
    : new LocalDiskStorageAdapter(path.resolve(config.STORAGE_DIRECTORY));
const app = createApp({
  checkDatabase: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  authRouter: createAuthRouter({
    prisma,
    config,
    mailer: createMailer(config),
  }),
  webOrigins: config.WEB_ORIGINS,
  apiRouter: createApiRouter(prisma, {
    auth: apiAuth,
    optionalAuth,
    csrf: requireCsrf(config),
    storage,
    requirePermission: (permissions) =>
      requireRoleAndPermission(
        permissions.includes('search:read')
          ? [AccountRole.ADMIN, AccountRole.PHARMACIST, AccountRole.CUSTOMER]
          : [AccountRole.ADMIN, AccountRole.PHARMACIST],
        permissions,
      ),
  }),
  uploadDirectory: config.STORAGE_DIRECTORY,
});

const server = app.listen(config.API_PORT, () => {
  console.info(`API listening on port ${config.API_PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async (error) => {
      await prisma.$disconnect();
      if (error) {
        console.error('API shutdown failed', error);
        process.exitCode = 1;
      }
    });
  });
}
