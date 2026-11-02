import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

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

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://localhost:5432/pharmacy_dev?schema=public',
  },
});
