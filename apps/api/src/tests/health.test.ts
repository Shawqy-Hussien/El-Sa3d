import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { createApp } from '../app.js';
import { createApiRouter } from '../routes/index.js';

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

process.env.DATABASE_URL ??= 'postgresql://pharmacy_user:postgres@127.0.0.1:5432/pharmacy_dev?schema=public';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const app = createApp({
  checkDatabase: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  authRouter: Router(),
  webOrigins: ['http://localhost:5173'],
  apiRouter: createApiRouter(prisma),
});

describe('Phase 2 backend foundation', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serves the health live endpoint', async () => {
    const response = await request(app).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body.service).toBe('api');
    expect(response.body.status).toBe('ok');
  });

  it('serves the health ready endpoint', async () => {
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.service).toBe('api');
    expect(response.body.status).toBe('ok');
  });

  it('serves swagger documentation', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Swagger UI');
  });
});
