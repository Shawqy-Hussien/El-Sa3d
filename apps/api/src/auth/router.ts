import rateLimit from 'express-rate-limit';
import { Router, type Request, type Response } from 'express';
import type { AppConfig } from '@elsa3d/config';
import {
  emailVerificationSchema,
  loginSchema,
  paginationSchema,
  passwordChangeSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
  registrationSchema,
} from '@elsa3d/shared-validation';
import { AccountRole, PrismaClient } from '../generated/prisma/client.js';
import { AuthError } from './errors.js';
import type { Mailer } from './mailer.js';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  authenticate,
  isCookieTransport,
  requireCsrf,
  requireRoleAndPermission,
} from './middleware.js';
import {
  AuthService,
  type RequestMetadata,
  type SessionTokens,
} from './service.js';
import { createCsrfToken } from './security.js';

export interface AuthRouterDependencies {
  prisma: PrismaClient;
  config: AppConfig;
  mailer: Mailer;
  rateLimits?: Partial<AuthRateLimits>;
}

export interface AuthRateLimits {
  windowMs: number;
  standard: number;
  login: number;
  reset: number;
}

const defaultRateLimits: AuthRateLimits = {
  windowMs: 15 * 60 * 1000,
  standard: 20,
  login: 5,
  reset: 5,
};

const acceptedMessage =
  'If the request can be completed, instructions will be sent to the provided address.';

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const { prisma, config, mailer } = dependencies;
  const service = new AuthService(prisma, config, mailer);
  const limits = { ...defaultRateLimits, ...dependencies.rateLimits };
  const router = Router();
  const csrf = requireCsrf(config);
  const auth = authenticate(prisma, config);
  const standardLimit = createLimiter(prisma, limits.windowMs, limits.standard);
  const loginLimit = createLimiter(prisma, limits.windowMs, limits.login);
  const resetLimit = createLimiter(prisma, limits.windowMs, limits.reset);
  router.use(standardLimit);

  router.get('/csrf', (_request, response) => {
    const token = createCsrfToken(config.ACCESS_TOKEN_SECRET);
    response.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1',
    });
    response.json({ csrfToken: token });
  });

  router.post('/register', csrf, async (request, response) => {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) return invalidRequest(response);
    await service.register(
      parsed.data.email,
      parsed.data.password,
      metadata(request),
    );
    response.status(202).json({ message: acceptedMessage });
  });

  router.post('/login', loginLimit, csrf, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return invalidRequest(response);
    const tokens = await service.login(
      parsed.data.email,
      parsed.data.password,
      metadata(request),
    );
    sendSession(response, tokens, config, isCookieTransport(request));
  });

  router.post('/email/verify', csrf, async (request, response) => {
    const parsed = emailVerificationSchema.safeParse(request.body);
    if (!parsed.success) return invalidRequest(response);
    await service.verifyEmail(parsed.data.token, metadata(request));
    response.status(204).end();
  });

  router.post('/refresh', loginLimit, csrf, async (request, response) => {
    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) return invalidRequest(response);
    const refreshToken = isCookieTransport(request)
      ? request.cookies?.[REFRESH_COOKIE]
      : parsed.data.refreshToken;
    if (!refreshToken)
      throw new AuthError(
        401,
        'invalid_refresh_token',
        'Refresh token is invalid or expired.',
      );
    const tokens = await service.refresh(refreshToken, metadata(request));
    sendSession(response, tokens, config, isCookieTransport(request));
  });

  router.post('/logout', csrf, async (request, response) => {
    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) return invalidRequest(response);
    const refreshToken = isCookieTransport(request)
      ? request.cookies?.[REFRESH_COOKIE]
      : parsed.data.refreshToken;
    await service.logout(refreshToken, undefined, undefined, metadata(request));
    clearAuthCookies(response, config);
    response.status(204).end();
  });

  router.post('/change-password', csrf, auth, async (request, response) => {
    const parsed = passwordChangeSchema.safeParse(request.body);
    if (!parsed.success) return invalidRequest(response);
    await service.changePassword(
      request.auth!.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      metadata(request),
    );
    clearAuthCookies(response, config);
    response.status(204).end();
  });

  router.post(
    '/password-reset/request',
    resetLimit,
    csrf,
    async (request, response) => {
      const parsed = passwordResetRequestSchema.safeParse(request.body);
      if (!parsed.success) return invalidRequest(response);
      await service.requestPasswordReset(parsed.data.email, metadata(request));
      response.status(202).json({ message: acceptedMessage });
    },
  );

  router.post(
    '/password-reset/confirm',
    resetLimit,
    csrf,
    async (request, response) => {
      const parsed = passwordResetConfirmSchema.safeParse(request.body);
      if (!parsed.success) return invalidRequest(response);
      await service.resetPassword(
        parsed.data.token,
        parsed.data.password,
        metadata(request),
      );
      response.status(204).end();
    },
  );

  router.get('/sessions', auth, async (request, response) => {
    const sessions = await service.listSessions(
      request.auth!.userId,
      request.auth!.sessionId,
    );
    response.json({ sessions });
  });

  router.post(
    '/sessions/:sessionId/revoke',
    csrf,
    auth,
    async (request, response) => {
      const rawSessionId = request.params.sessionId;
      const sessionId = Array.isArray(rawSessionId)
        ? rawSessionId[0]
        : rawSessionId;
      if (!isUuid(sessionId)) return invalidRequest(response);
      await service.revokeSession(
        request.auth!.userId,
        sessionId,
        metadata(request),
      );
      response.status(204).end();
    },
  );

  router.get(
    '/admin/auth-audit-events',
    auth,
    requireRoleAndPermission(
      [AccountRole.ADMIN, AccountRole.PHARMACIST],
      ['auth:audit:read'],
    ),
    async (request, response) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) return invalidRequest(response);
      response.json({
        events: await service.auditEvents(
          parsed.data.page,
          parsed.data.pageSize,
        ),
      });
    },
  );

  return router;
}

function createLimiter(prisma: PrismaClient, windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler(request, response) {
      void prisma.authAuditEvent
        .create({
          data: {
            action: 'auth.rate_limited',
            ipAddress: request.ip?.slice(0, 45) ?? null,
            userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
          },
        })
        .catch((error: unknown) =>
          console.error('Auth rate-limit audit failed', error),
        );
      response.status(429).json({
        error: 'too_many_requests',
        message: 'Too many requests. Please try again later.',
      });
    },
  });
}

function metadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip?.slice(0, 45) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
  };
}

function sendSession(
  response: Response,
  tokens: SessionTokens,
  config: AppConfig,
  cookieTransport: boolean,
): void {
  if (!cookieTransport) {
    response.json({ ...tokens, tokenType: 'Bearer' });
    return;
  }

  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/v1',
    maxAge: tokens.accessTokenExpiresIn * 1000,
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/v1',
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  response.json({
    user: tokens.user,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
  });
}

function clearAuthCookies(response: Response, config: AppConfig): void {
  const options = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/api/v1',
  };
  response.clearCookie(ACCESS_COOKIE, options);
  response.clearCookie(REFRESH_COOKIE, options);
}

function invalidRequest(response: Response) {
  response
    .status(400)
    .json({ error: 'invalid_request', message: 'Request is invalid.' });
}

function isUuid(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
