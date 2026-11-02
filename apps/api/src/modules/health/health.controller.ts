import type { Request, Response } from 'express';
import { HealthService } from './health.service.js';

export class HealthController {
  constructor(private readonly service: HealthService) {}

  getLive = async (_request: Request, response: Response): Promise<void> => {
    const body = await this.service.getLive();
    response.json(body);
  };

  getReady = async (_request: Request, response: Response): Promise<void> => {
    try {
      const body = await this.service.getReady();
      response.json(body);
    } catch {
      response.status(503).json({
        service: 'api',
        status: 'degraded',
        timestamp: new Date().toISOString(),
      });
    }
  };
}
