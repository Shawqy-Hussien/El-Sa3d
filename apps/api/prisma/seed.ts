import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { AccountRole, PrismaClient } from '../src/generated/prisma/client.js';

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

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed is blocked in production.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed demo data.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.info('Seeding fictional demo roles, permissions, categories, brands, and products.');

  const roleKeys = [
    { key: 'customer', name: 'Customer' },
    { key: 'admin', name: 'Admin' },
    { key: 'pharmacist', name: 'Pharmacist' },
    { key: 'delivery_agent', name: 'Delivery Agent' },
  ] as const;

  const permissions = [
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'auth:audit:read',
    'users:roles:manage',
    'prescriptions:verify',
    'deliveries:update',
  ];

  const permissionRows = await Promise.all(
    permissions.map(async (key) => {
      const existing = await prisma.permission.findUnique({ where: { key } });
      return existing ?? prisma.permission.create({ data: { key, description: 'Fictional demo permission.' } });
    }),
  );

  for (const role of roleKeys) {
    const existing = await prisma.role.findUnique({ where: { key: role.key } });
    if (!existing) {
      await prisma.role.create({
        data: {
          key: role.key,
          name: role.name,
          description: 'Fictional demo role.',
          permissions: {
            create: permissionRows
              .filter((permission) => {
                if (role.key === 'customer') {
                  return ['profile:read', 'profile:write', 'auth:sessions:read', 'auth:sessions:revoke'].includes(permission.key);
                }
                if (role.key === 'admin') {
                  return ['profile:read', 'auth:sessions:read', 'auth:sessions:revoke', 'auth:audit:read', 'users:roles:manage'].includes(permission.key);
                }
                if (role.key === 'pharmacist') {
                  return ['profile:read', 'auth:sessions:read', 'prescriptions:verify'].includes(permission.key);
                }
                return ['profile:read', 'auth:sessions:read', 'deliveries:update'].includes(permission.key);
              })
              .map((permission) => ({ permissionId: permission.id })),
          },
        },
      });
    }
  }

  const parentCategory = await prisma.category.upsert({
    where: { slug: 'wellness' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Wellness',
      slug: 'wellness',
      description: 'Fictional demo category for wellness items.',
      sortOrder: 1,
    },
  });

  const childCategory = await prisma.category.upsert({
    where: { slug: 'vitamins' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Vitamins',
      slug: 'vitamins',
      description: 'Fictional demo category for vitamin supplements.',
      sortOrder: 2,
      parentId: parentCategory.id,
    },
  });

  const brand = await prisma.brand.upsert({
    where: { slug: 'nova-form' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Nova Form',
      slug: 'nova-form',
      description: 'Fictional demo brand for retail products.',
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'daily-essential-vitamin' },
    update: { nameAr: 'فيتامين يومي أساسي', type: 'SUPPLEMENT' },
    create: {
      id: randomUUID(),
      name: 'Daily Essential Vitamin',
      nameAr: 'فيتامين يومي أساسي',
      slug: 'daily-essential-vitamin',
      description: 'Fictional demo product created for local development and testing only.',
      categoryId: childCategory.id,
      brandId: brand.id,
      status: 'ACTIVE',
      type: 'SUPPLEMENT',
    },
  });

  const vitaminVariant = await prisma.productVariant.upsert({
    where: { sku: 'DE-001' },
    update: {},
    create: {
      id: randomUUID(),
      productId: product.id,
      sku: 'DE-001',
      name: '30 capsules',
      unitLabel: 'bottle',
      price: 184.50,
      currency: 'EGP',
      barcode: 'DE-001-BAR',
      isActive: true,
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: vitaminVariant.id },
    update: { quantity: 36, reorderLevel: 8 },
    create: { variantId: vitaminVariant.id, quantity: 36, reorderLevel: 8 },
  });

  const personalCare = await prisma.category.upsert({
    where: { slug: 'personal-care' },
    update: {},
    create: { name: 'Personal Care', slug: 'personal-care', sortOrder: 3 },
  });
  const botanicalBrand = await prisma.brand.upsert({
    where: { slug: 'bayt-botanicals' },
    update: {},
    create: { name: 'Bayt Botanicals', slug: 'bayt-botanicals' },
  });
  const careProduct = await prisma.product.upsert({
    where: { slug: 'daily-hydration-lotion' },
    update: { nameAr: 'لوشن الترطيب اليومي', type: 'PERSONAL_CARE' },
    create: {
      name: 'Daily Hydration Lotion',
      nameAr: 'لوشن الترطيب اليومي',
      slug: 'daily-hydration-lotion',
      description: 'Fictional demo personal-care product.',
      categoryId: personalCare.id,
      brandId: botanicalBrand.id,
      type: 'PERSONAL_CARE',
      status: 'ACTIVE',
    },
  });
  const careVariant = await prisma.productVariant.upsert({
    where: { sku: 'DB-002' },
    update: {},
    create: {
      productId: careProduct.id,
      sku: 'DB-002',
      name: '200 ml',
      unitLabel: 'bottle',
      price: 220,
      compareAtPrice: 260,
      currency: 'EGP',
      isActive: true,
    },
  });
  await prisma.inventory.upsert({
    where: { variantId: careVariant.id },
    update: { quantity: 24, reorderLevel: 6 },
    create: { variantId: careVariant.id, quantity: 24, reorderLevel: 6 },
  });

  const imageRecords = [
    {
      productId: product.id,
      url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=85',
      altText: 'Fictional vitamin bottle',
    },
    {
      productId: careProduct.id,
      url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=85',
      altText: 'Fictional personal-care bottle',
    },
  ];
  for (const image of imageRecords) {
    const existing = await prisma.productImage.findFirst({
      where: { productId: image.productId, url: image.url },
    });
    if (!existing) await prisma.productImage.create({ data: image });
  }

  const banner = await prisma.storefrontBanner.findFirst({
    where: { title: 'A calmer daily ritual' },
  });
  if (!banner) {
    await prisma.storefrontBanner.create({
      data: {
        title: 'A calmer daily ritual',
        titleAr: 'لحظات عناية تبدأ من هنا',
        subtitle: 'Thoughtful essentials for the everyday.',
        subtitleAr: 'اختيارات يومية بعناية واهتمام.',
        imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1800&q=90',
        href: '/products?category=personal-care',
        sortOrder: 1,
      },
    });
  }

  const now = new Date();
  const offer = await prisma.promotion.findFirst({
    where: { name: 'Welcome to better routines' },
  });
  if (!offer) {
    await prisma.promotion.create({
      data: {
        name: 'Welcome to better routines',
        nameAr: 'خصم على اختياراتك اليومية',
        description: 'Save 15% on selected everyday essentials.',
        descriptionAr: 'وفّر ١٥٪ على مجموعة مختارة من الأساسيات اليومية.',
        type: 'PERCENTAGE',
        value: 15,
        startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
  }

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo.customer@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'demo.customer@example.com',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$demo-hash-placeholder',
      role: AccountRole.CUSTOMER,
      emailVerifiedAt: new Date(),
      customerProfile: {
        create: {
          firstName: 'Demo',
          lastName: 'Customer',
          phone: '+966500000001',
        },
      },
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoUser.id, roleId: (await prisma.role.findUniqueOrThrow({ where: { key: 'customer' } })).id } },
    update: {},
    create: {
      userId: demoUser.id,
      roleId: (await prisma.role.findUniqueOrThrow({ where: { key: 'customer' } })).id,
    },
  });

  console.info('Fictional demo data created successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
