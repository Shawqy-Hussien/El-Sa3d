import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '../auth/errors.js';
import { HttpError } from '../errors/http-error.js';

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof AuthError) {
    response.status(error.status).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({
      success: false,
      error: error.code,
      message: error.message,
      details: error.details ?? null,
    });
    return;
  }

  console.error('Unhandled API error', error);
  response.status(500).json({
    success: false,
    error: 'internal_error',
    message: 'An unexpected error occurred.',
  });
}
