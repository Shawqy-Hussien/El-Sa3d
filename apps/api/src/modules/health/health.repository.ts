import type { PrismaClient } from '../../generated/prisma/client.js';

export class HealthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
