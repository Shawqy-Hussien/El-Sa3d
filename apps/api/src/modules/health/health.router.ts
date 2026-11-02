import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HealthController } from './health.controller.js';
import { HealthRepository } from './health.repository.js';
import { HealthService } from './health.service.js';

export function createHealthRouter(prisma: PrismaClient): Router {
  const router = Router();
  const controller = new HealthController(
    new HealthService(new HealthRepository(prisma)),
  );

  router.get('/live', controller.getLive);
  router.get('/ready', controller.getReady);

  return router;
}
