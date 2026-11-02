import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createCatalogRouter } from '../modules/catalog/catalog.router.js';
import type { StorageAdapter } from '../modules/catalog/storage.js';
import { createHealthRouter } from '../modules/health/health.router.js';
import { createStorefrontRouter } from '../modules/storefront/storefront.router.js';
import { createPrescriptionRouter } from '../modules/prescriptions/prescription.router.js';

export interface ApiRouterOptions {
  auth?: RequestHandler;
  optionalAuth?: RequestHandler;
  csrf?: RequestHandler;
  requirePermission?: (permissions: readonly string[]) => RequestHandler;
  storage?: StorageAdapter;
}

export function createApiRouter(
  prisma?: PrismaClient,
  options: ApiRouterOptions = {},
): Router {
  const router = Router();

  if (prisma) {
    router.use('/health', createHealthRouter(prisma));
    router.use('/products', createCatalogRouter(prisma, options));
    router.use('/storefront', createStorefrontRouter(prisma));
    if (options.auth && options.csrf && options.storage) {
      router.use(
        '/prescriptions',
        createPrescriptionRouter(prisma, options.auth, options.csrf, options.storage),
      );
    }
  }

  return router;
}
