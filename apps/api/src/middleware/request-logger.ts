import type { NextFunction, Request, Response } from 'express';

export function requestLogger(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  const method = request.method;
  const url = request.originalUrl || request.url;

  request.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.info(
      JSON.stringify({
        level: 'http',
        method,
        url,
        status: _response.statusCode,
        durationMs,
      }),
    );
  });

  next();
}
