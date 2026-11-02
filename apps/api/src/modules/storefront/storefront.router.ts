import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';

export function createStorefrontRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/content', async (_request, response) => {
    const now = new Date();
    const [banners, offers] = await Promise.all([
      prisma.storefrontBanner.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.promotion.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { startsAt: 'desc' },
      }),
    ]);

    response.json({ banners, offers });
  });

  return router;
}
