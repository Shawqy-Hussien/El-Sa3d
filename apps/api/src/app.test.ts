import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { Router } from 'express';
import { createApp } from './app.js';
import { AccountRole } from './generated/prisma/client.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { requireRoleAndPermission } from './auth/middleware.js';
import { CatalogRepository } from './modules/catalog/catalog.repository.js';
import { normalizeArabic } from './modules/catalog/search.js';
import { createApiRouter } from './routes/index.js';

function createTestApp(checkDatabase: () => Promise<void>) {
  return createApp({ checkDatabase, authRouter: Router(), webOrigins: [] });
}

test('liveness does not depend on database availability', async () => {
  const app = createTestApp(async () => {
    throw new Error('database unavailable');
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/health/live`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      await response.json().then((body: unknown) => {
        const value = body as {
          service: string;
          status: string;
          timestamp: string;
        };
        return {
          service: value.service,
          status: value.status,
          hasTimestamp: Boolean(value.timestamp),
        };
      }),
      { service: 'api', status: 'ok', hasTimestamp: true },
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('API root returns a hello response', async () => {
  const app = createTestApp(async () => {});
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: 'Hello from the El-Sa3d API',
      service: 'api',
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('OpenAPI endpoint documents the authentication routes', async () => {
  const app = createTestApp(async () => {});
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/openapi.json`,
    );
    const document = await response.json();

    assert.equal(response.status, 200);
    assert.equal(document.openapi, '3.1.0');
    assert.ok(document.paths['/auth/register']?.post);
    assert.ok(document.paths['/auth/refresh']?.post);
    assert.ok(document.paths['/auth/password-reset/confirm']?.post);
    assert.ok(document.paths['/auth/admin/auth-audit-events']?.get);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('readiness requires a successful database query', async () => {
  const app = createTestApp(async () => {
    throw new Error('database unavailable');
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/health/ready`,
    );

    assert.equal(response.status, 503);
    assert.deepEqual(
      await response.json().then((body: unknown) => {
        const value = body as {
          service: string;
          status: string;
          timestamp: string;
        };
        return {
          service: value.service,
          status: value.status,
          hasTimestamp: Boolean(value.timestamp),
        };
      }),
      { service: 'api', status: 'degraded', hasTimestamp: true },
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('readiness succeeds only after the database check succeeds', async () => {
  let checked = false;
  const app = createTestApp(async () => {
    checked = true;
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/health/ready`,
    );

    assert.equal(checked, true);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('catalog products endpoint returns active catalog items', async () => {
  const mockPrisma = {
    product: {
      findMany: async () => [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Paracetamol',
          slug: 'paracetamol',
          description: 'Pain relief medication',
          status: 'ACTIVE',
          category: { id: 'aaaa', name: 'Pain Relief' },
          brand: { id: 'bbbb', name: 'El-Sa3d' },
          variants: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Paracetamol 500mg',
              price: '25.50',
              currency: 'EGP',
              inventory: { quantity: 40, reservedQuantity: 3 },
            },
          ],
        },
      ],
    },
  };

  const app = createApp({
    checkDatabase: async () => {},
    authRouter: Router(),
    webOrigins: [],
    apiRouter: createApiRouter(mockPrisma as unknown as PrismaClient),
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/products`,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    const items = payload.products ?? payload.items ?? [];
    assert.deepEqual(items, [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Paracetamol',
        slug: 'paracetamol',
        description: 'Pain relief medication',
        status: 'ACTIVE',
        category: { id: 'aaaa', name: 'Pain Relief' },
        brand: { id: 'bbbb', name: 'El-Sa3d' },
        variants: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Paracetamol 500mg',
            price: '25.50',
            currency: 'EGP',
            inventory: { quantity: 40, reservedQuantity: 3 },
          },
        ],
      },
    ]);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('catalog list applies filters, sorting, and hides archived items', async () => {
  const mockPrisma = {
    product: {
      findMany: async () => [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Panadol Extra',
          slug: 'panadol-extra',
          description: 'Pain relief medication',
          status: 'ACTIVE',
          category: { id: 'cat-1', name: 'Pain Relief' },
          brand: { id: 'brand-1', name: 'GSK' },
          variants: [
            {
              id: 'v-1',
              name: 'Panadol Extra 500mg',
              price: '55.00',
              currency: 'EGP',
              inventory: { quantity: 15, reservedQuantity: 0 },
            },
          ],
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Vitamin C',
          slug: 'vitamin-c',
          description: 'Immune support',
          status: 'ARCHIVED',
          category: { id: 'cat-2', name: 'Vitamins' },
          brand: { id: 'brand-2', name: 'Cure' },
          variants: [
            {
              id: 'v-2',
              name: 'Vitamin C 1000mg',
              price: '80.00',
              currency: 'EGP',
              inventory: { quantity: 45, reservedQuantity: 10 },
            },
          ],
        },
      ],
    },
    brand: { findMany: async () => [{ id: 'brand-1', name: 'GSK' }] },
    category: { findMany: async () => [{ id: 'cat-1', name: 'Pain Relief' }] },
  };

  const app = createApp({
    checkDatabase: async () => {},
    authRouter: Router(),
    webOrigins: [],
    apiRouter: createApiRouter(mockPrisma as unknown as PrismaClient),
  });

  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/products?brand=brand-1&sort=price_desc&inStock=true&page=1&pageSize=20`,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].name, 'Panadol Extra');
    assert.ok(payload.items[0].variants[0].inventory.quantity >= 1);
    assert.equal(payload.meta.total, 1);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Arabic search is normalized across variations and returns suggestions', async () => {
  const mockPrisma = {
    product: {
      findMany: async () => [
        {
          id: 'p-1',
          name: 'باراسيتامول',
          slug: 'باراسيتامول',
          description: 'مسكن',
          activeIngredient: 'باراسيتامول',
          status: 'ACTIVE',
          category: { id: 'cat-1', name: 'ألم' },
          brand: { id: 'brand-1', name: 'ديتول' },
          variants: [
            {
              id: 'v-1',
              name: 'باراسيتامول 500 مغ',
              price: '25.00',
              currency: 'EGP',
              inventory: { quantity: 12, reservedQuantity: 0 },
            },
          ],
        },
      ],
    },
    brand: { findMany: async () => [{ id: 'brand-1', name: 'ديتول' }] },
    category: { findMany: async () => [{ id: 'cat-1', name: 'ألم' }] },
  };

  const app = createApp({
    checkDatabase: async () => {},
    authRouter: Router(),
    webOrigins: [],
    apiRouter: createApiRouter(mockPrisma as unknown as PrismaClient),
  });

  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/products/search?q=باراسيتامول&limit=5`,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.items.length >= 1);
    assert.equal(payload.items[0].name, 'باراسيتامول');
    assert.ok(Array.isArray(payload.suggestions));
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Arabic normalization handles hamza, taa marbuta, and diacritics', () => {
  assert.equal(normalizeArabic('إيبوبروفين'), normalizeArabic('ايبوبروفين'));
  assert.equal(normalizeArabic('مشكاة'), normalizeArabic('مشكاه'));
  assert.equal(normalizeArabic('مُسَكِّن'), normalizeArabic('مسكن'));
});

test('inventory adjustments update stock and write a matching movement atomically', async () => {
  let writtenQuantity = 0;
  let writtenMovement: Record<string, unknown> | undefined;
  const transaction = {
    inventory: {
      findUnique: async () => ({ quantity: 5, reservedQuantity: 1 }),
      upsert: async ({ update }: { update: { quantity: number } }) => {
        writtenQuantity = update.quantity;
      },
    },
    inventoryMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writtenMovement = data;
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (
      callback: (tx: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  };

  const repository = new CatalogRepository(prisma as unknown as PrismaClient);
  await repository.adjustInventory({
    variantId: 'variant-1',
    quantityChange: 4,
    actorUserId: 'user-1',
    reason: 'restock',
  });

  assert.equal(writtenQuantity, 9);
  assert.equal(writtenMovement?.type, 'STOCK_IN');
  assert.equal(writtenMovement?.quantityChange, 4);
  assert.equal(writtenMovement?.actorUserId, 'user-1');
});

test('catalog write endpoints reject customers through the permission policy', async () => {
  const mockPrisma = {
    product: { create: async () => assert.fail('write must be blocked') },
  };
  const app = createApp({
    checkDatabase: async () => {},
    authRouter: Router(),
    webOrigins: [],
    apiRouter: createApiRouter(mockPrisma as unknown as PrismaClient, {
      auth: (_request, _response, next) => {
        _request.auth = {
          userId: 'customer-1',
          sessionId: 'session-1',
          email: 'customer@example.test',
          role: AccountRole.CUSTOMER,
          emailVerified: true,
        };
        next();
      },
      requirePermission: (permissions) =>
        requireRoleAndPermission(
          [AccountRole.ADMIN, AccountRole.PHARMACIST],
          permissions,
        ),
    }),
  });
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/products/admin/products`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categoryId: 'category-1',
          name: 'Test',
          slug: 'test',
        }),
      },
    );
    assert.equal(response.status, 403);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
