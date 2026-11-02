import type { HealthResponse } from '@elsa3d/shared-types';
import { HealthRepository } from './health.repository.js';

export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async getLive(): Promise<HealthResponse> {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady(): Promise<HealthResponse> {
    await this.repository.checkDatabase();
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
