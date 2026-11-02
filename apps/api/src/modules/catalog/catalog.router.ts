import express, { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { RequestHandler } from 'express';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import type { StorageAdapter } from './storage.js';

export interface CatalogRouterOptions {
  auth?: RequestHandler;
  optionalAuth?: RequestHandler;
  requirePermission?: (permissions: readonly string[]) => RequestHandler;
  storage?: StorageAdapter;
}

export function createCatalogRouter(
  prisma: PrismaClient,
  options: CatalogRouterOptions = {},
): Router {
  const router = Router();
  const repository = new CatalogRepository(prisma);
  const controller = new CatalogController(new CatalogService(repository));
  const protect = (permission: string): RequestHandler[] =>
    options.auth && options.requirePermission
      ? [options.auth, options.requirePermission([permission])]
      : [
          (_request, response) => {
            response.status(503).json({ error: 'authorization_unconfigured' });
          },
        ];

  router.get('/', controller.getProducts);
  router.get('/categories', controller.getCategories);
  router.get('/brands', controller.getBrands);
  router.get('/search/suggestions', controller.searchSuggestions);
  router.get(
    '/search',
    ...(options.optionalAuth ? [options.optionalAuth] : []),
    controller.searchProducts,
  );
  router.get(
    '/search/recent',
    ...protect('search:read'),
    async (request, response) => {
      response.json({
        searches: await repository.listRecentSearches(request.auth!.userId),
      });
    },
  );
  router.get(
    '/inventory/low-stock',
    ...protect('inventory:read'),
    async (_request, response) => {
      response.json({ items: await repository.getLowStockProducts() });
    },
  );

  router.post(
    '/admin/products',
    ...protect('catalog:write'),
    async (request, response) => {
      const body = productInput(request.body);
      if (!body) return invalid(response);
      response
        .status(201)
        .json({ product: await repository.createProduct(body) });
    },
  );
  router.patch(
    '/admin/products/:productId',
    ...protect('catalog:write'),
    async (request, response) => {
      const id = param(request, 'productId');
      const body = productInput(request.body, true);
      if (!id || !body) return invalid(response);
      response.json({ product: await repository.updateProduct(id, body) });
    },
  );
  router.delete(
    '/admin/products/:productId',
    ...protect('catalog:write'),
    async (request, response) => {
      const id = param(request, 'productId');
      if (!id) return invalid(response);
      response.json({ product: await repository.archiveProduct(id) });
    },
  );
  router.post(
    '/admin/products/:productId/variants',
    ...protect('catalog:write'),
    async (request, response) => {
      const productId = param(request, 'productId');
      const body = variantInput(request.body);
      if (!productId || !body) return invalid(response);
      response
        .status(201)
        .json({ variant: await repository.createVariant(productId, body) });
    },
  );
  router.patch(
    '/admin/variants/:variantId',
    ...protect('catalog:write'),
    async (request, response) => {
      const variantId = param(request, 'variantId');
      const body = variantInput(request.body, true);
      if (!variantId || !body) return invalid(response);
      response.json({
        variant: await repository.updateVariant(variantId, body),
      });
    },
  );
  router.post(
    '/admin/categories',
    ...protect('catalog:write'),
    async (request, response) => {
      const body = taxonomyInput(request.body);
      if (!body) return invalid(response);
      response
        .status(201)
        .json({ category: await repository.createCategory(body) });
    },
  );
  router.patch(
    '/admin/categories/:categoryId',
    ...protect('catalog:write'),
    async (request, response) => {
      const id = param(request, 'categoryId');
      const body = taxonomyInput(request.body, true);
      if (!id || !body) return invalid(response);
      response.json({ category: await repository.updateCategory(id, body) });
    },
  );
  router.post(
    '/admin/brands',
    ...protect('catalog:write'),
    async (request, response) => {
      const body = taxonomyInput(request.body);
      if (!body) return invalid(response);
      response.status(201).json({ brand: await repository.createBrand(body) });
    },
  );
  router.patch(
    '/admin/brands/:brandId',
    ...protect('catalog:write'),
    async (request, response) => {
      const id = param(request, 'brandId');
      const body = taxonomyInput(request.body, true);
      if (!id || !body) return invalid(response);
      response.json({ brand: await repository.updateBrand(id, body) });
    },
  );
  router.post(
    '/admin/products/:productId/images/upload',
    ...protect('catalog:write'),
    express.raw({ type: () => true, limit: '10mb' }),
    async (request, response) => {
      const productId = param(request, 'productId');
      const mimeType = request.get('content-type')?.split(';')[0];
      if (
        !productId ||
        !Buffer.isBuffer(request.body) ||
        request.body.length === 0 ||
        !options.storage ||
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
          mimeType ?? '',
        )
      )
        return invalid(response);
      const fileName =
        request.get('x-file-name')?.slice(0, 240) ?? 'upload.bin';
      const url = await options.storage.uploadFile({
        originalName: fileName,
        buffer: request.body,
        mimeType,
      });
      const image = await repository.createImage(productId, {
        url,
        altText: request.get('x-image-alt')?.slice(0, 240),
      });
      response.status(201).json({ image });
    },
  );
  router.patch(
    '/admin/images/:imageId',
    ...protect('catalog:write'),
    async (request, response) => {
      const imageId = param(request, 'imageId');
      const body = imageInput(request.body);
      if (!imageId || !body) return invalid(response);
      response.json({ image: await repository.updateImage(imageId, body) });
    },
  );
  router.delete(
    '/admin/images/:imageId',
    ...protect('catalog:write'),
    async (request, response) => {
      const imageId = param(request, 'imageId');
      if (!imageId) return invalid(response);
      const image = await repository.deleteImage(imageId);
      await options.storage?.deleteFile(image.url);
      response.json({ deleted: true });
    },
  );
  router.post(
    '/admin/variants/:variantId/inventory-movements',
    ...protect('inventory:write'),
    async (request, response) => {
      const variantId = param(request, 'variantId');
      const quantityChange = request.body?.quantityChange;
      if (
        !variantId ||
        !Number.isSafeInteger(quantityChange) ||
        quantityChange === 0
      )
        return invalid(response);
      const movement = await repository.adjustInventory({
        variantId,
        quantityChange,
        actorUserId: request.auth!.userId,
        reason:
          typeof request.body.reason === 'string'
            ? request.body.reason.slice(0, 500)
            : undefined,
      });
      response.status(201).json({ movement });
    },
  );

  router.get('/:productId', controller.getProductById);

  return router;
}

function productInput(
  value: unknown,
  partial = false,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const allowed = [
    'categoryId',
    'brandId',
    'name',
    'nameAr',
    'slug',
    'description',
    'activeIngredient',
    'activeIngredientAr',
    'type',
    'prescriptionRequired',
    'status',
  ];
  const input = Object.fromEntries(
    Object.entries(value).filter(([key]) => allowed.includes(key)),
  );
  if (!partial && (!input.categoryId || !input.name || !input.slug))
    return null;
  if (
    'description' in input &&
    input.description !== null &&
    typeof input.description !== 'string'
  )
    return null;
  if (
    'prescriptionRequired' in input &&
    typeof input.prescriptionRequired !== 'boolean'
  )
    return null;
  return input;
}

function variantInput(
  value: unknown,
  partial = false,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const allowed = [
    'sku',
    'barcode',
    'name',
    'unitLabel',
    'price',
    'compareAtPrice',
    'currency',
    'isActive',
  ];
  const input = Object.fromEntries(
    Object.entries(value).filter(([key]) => allowed.includes(key)),
  );
  if (
    !partial &&
    (!input.sku || !input.name || !input.unitLabel || input.price === undefined)
  )
    return null;
  if (
    'price' in input &&
    (!Number.isFinite(Number(input.price)) || Number(input.price) < 0)
  )
    return null;
  return input;
}

function taxonomyInput(
  value: unknown,
  partial = false,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const allowed = [
    'name',
    'slug',
    'description',
    'parentId',
    'sortOrder',
    'isActive',
  ];
  const input = Object.fromEntries(
    Object.entries(value).filter(([key]) => allowed.includes(key)),
  );
  if (!partial && (!input.name || !input.slug)) return null;
  return input;
}

function imageInput(
  value: unknown,
): { altText?: string | null; sortOrder?: number } | null {
  if (!isRecord(value)) return null;
  const input: { altText?: string | null; sortOrder?: number } = {};
  if ('altText' in value) {
    if (value.altText !== null && typeof value.altText !== 'string')
      return null;
    input.altText = value.altText as string | null;
  }
  if ('sortOrder' in value) {
    if (!Number.isSafeInteger(value.sortOrder)) return null;
    input.sortOrder = value.sortOrder as number;
  }
  return Object.keys(input).length ? input : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function param(request: Request, key: string): string | null {
  const value = request.params[key];
  return typeof value === 'string' ? value : null;
}

function invalid(response: Response): void {
  response.status(400).json({ error: 'invalid_request' });
}
