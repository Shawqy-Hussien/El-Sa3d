export interface HealthResponse {
  service: 'api';
  status: 'ok' | 'degraded';
  timestamp: string;
}
