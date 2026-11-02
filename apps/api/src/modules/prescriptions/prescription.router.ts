import express, { Router, type RequestHandler } from 'express';
import { AccountRole, type PrismaClient } from '../../generated/prisma/client.js';
import type { StorageAdapter } from '../catalog/storage.js';

export function createPrescriptionRouter(
  prisma: PrismaClient,
  authenticate: RequestHandler,
  csrf: RequestHandler,
  storage: StorageAdapter,
): Router {
  const router = Router();

  router.post(
    '/',
    authenticate,
    csrf,
    express.raw({ type: () => true, limit: '10mb' }),
    async (request, response) => {
      const mimeType = request.get('content-type')?.split(';')[0];
      if (
        request.auth?.role !== AccountRole.CUSTOMER ||
        !Buffer.isBuffer(request.body) ||
        request.body.length === 0 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType ?? '')
      ) {
        response.status(400).json({ error: 'invalid_prescription_upload' });
        return;
      }

      const fileKey = await storage.uploadFile({
        originalName: request.get('x-file-name')?.slice(0, 240) ?? 'prescription',
        buffer: request.body,
        mimeType,
      });
      const prescription = await prisma.prescription.create({
        data: {
          userId: request.auth.userId,
          fileKey,
          mimeType: mimeType!,
        },
        select: { id: true, status: true, submittedAt: true },
      });
      response.status(201).json({ prescription });
    },
  );

  return router;
}
