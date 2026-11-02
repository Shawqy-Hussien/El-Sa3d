import { jwtVerify } from 'jose';
import type { AppConfig } from '@elsa3d/config';
import type { Request, RequestHandler } from 'express';
import { AccountRole, PrismaClient } from '../generated/prisma/client.js';
import { hasPermissions } from './policy.js';
import { verifyCsrfToken } from './security.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';

export function isCookieTransport(request: Request): boolean {
  return request.get('x-auth-transport') === 'cookie';
}

export function requireCsrf(config: AppConfig): RequestHandler {
  return (request, response, next) => {
    if (!isCookieTransport(request)) return next();

    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = request.get('x-csrf-token');
    if (
      !cookieToken ||
      !headerToken ||
      cookieToken !== headerToken ||
      !verifyCsrfToken(headerToken, config.ACCESS_TOKEN_SECRET)
    ) {
      response.status(403).json({
        error: 'csrf_invalid',
        message: 'Request could not be verified.',
      });
      return;
    }
    next();
  };
}

export function authenticate(
  prisma: PrismaClient,
  config: AppConfig,
): RequestHandler {
  return async (request, response, next) => {
    const token = isCookieTransport(request)
      ? request.cookies?.[ACCESS_COOKIE]
      : bearerToken(request.get('authorization'));
    if (!token) {
      response
        .status(401)
        .json({ error: 'unauthorized', message: 'Authentication required.' });
      return;
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(config.ACCESS_TOKEN_SECRET),
        { issuer: 'elsa3d-api', audience: 'elsa3d-clients' },
      );
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Invalid access claims');
      }

      const session = await prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { emailVerifiedAt: { not: null } },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              emailVerifiedAt: true,
            },
          },
        },
      });
      if (!session) throw new Error('Session is no longer active');

      request.auth = {
        userId: session.user.id,
        sessionId: session.id,
        email: session.user.email,
        role: session.user.role,
        emailVerified: session.user.emailVerifiedAt !== null,
      };
      next();
    } catch {
      response
        .status(401)
        .json({ error: 'unauthorized', message: 'Authentication required.' });
    }
  };
}

export function requireRoleAndPermission(
  roles: readonly AccountRole[],
  permissions: readonly string[],
): RequestHandler {
  return (request, response, next) => {
    const principal = request.auth;
    if (!principal) {
      response
        .status(401)
        .json({ error: 'unauthorized', message: 'Authentication required.' });
      return;
    }
    if (
      !roles.includes(principal.role) ||
      !hasPermissions(principal.role, permissions)
    ) {
      response.status(403).json({
        error: 'forbidden',
        message: 'You do not have access to this resource.',
      });
      return;
    }
    next();
  };
}

function bearerToken(authorization: string | undefined): string | undefined {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
