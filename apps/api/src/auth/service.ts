import argon2 from 'argon2';
import type { AppConfig } from '@elsa3d/config';
import {
  AccountRole,
  OneTimeTokenPurpose,
  PrismaClient,
} from '../generated/prisma/client.js';
import { AuthError } from './errors.js';
import type { Mailer } from './mailer.js';
import { createOpaqueToken, hashToken, signAccessToken } from './security.js';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  role: AccountRole;
  emailVerifiedAt: Date | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  sessionId: string;
  user: PublicUser;
}

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
} as const;

const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly mailer: Mailer,
  ) {}

  async register(
    email: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    let user = await this.prisma.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            email,
            passwordHash: await argon2.hash(password, passwordHashOptions),
            role: AccountRole.CUSTOMER,
          },
          select: publicUserSelect,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        user = await this.prisma.user.findUnique({
          where: { email },
          select: publicUserSelect,
        });
      }
    }

    await this.audit('registration.requested', user?.id ?? null, metadata);
    if (user && !user.emailVerifiedAt) {
      await this.sendOneTimeToken(
        user.id,
        user.email,
        OneTimeTokenPurpose.EMAIL_VERIFICATION,
        this.config.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
      );
    }
  }

  async verifyEmail(token: string, metadata: RequestMetadata): Promise<void> {
    const now = new Date();
    const tokenHash = hashToken(token);
    const user = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.oneTimeToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          purpose: true,
          expiresAt: true,
          consumedAt: true,
        },
      });
      if (
        !record ||
        record.purpose !== OneTimeTokenPurpose.EMAIL_VERIFICATION ||
        record.consumedAt ||
        record.expiresAt <= now
      ) {
        return null;
      }

      const consumed = await transaction.oneTimeToken.updateMany({
        where: {
          id: record.id,
          purpose: OneTimeTokenPurpose.EMAIL_VERIFICATION,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;

      return transaction.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
        select: publicUserSelect,
      });
    });

    if (!user) throw invalidOneTimeToken();
    await this.audit('email.verified', user.id, metadata);
  }

  async login(
    email: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const validPassword = user
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : false;

    if (!user || !validPassword || !user.emailVerifiedAt) {
      await this.audit('login.failed', user?.id ?? null, metadata);
      throw new AuthError(
        401,
        'invalid_credentials',
        'Invalid email or password.',
      );
    }

    const tokens = await this.createSession(user, metadata);
    await this.audit('login.succeeded', user.id, metadata);
    return tokens;
  }

  async refresh(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: { include: { user: true } } },
    });
    if (!stored) throw invalidRefreshToken();

    const now = new Date();
    if (stored.consumedAt) {
      await this.revokeSessionAndAudit(
        stored.sessionId,
        stored.session.userId,
        metadata,
      );
      throw invalidRefreshToken();
    }
    if (
      stored.session.revokedAt ||
      stored.expiresAt <= now ||
      stored.session.expiresAt <= now
    ) {
      throw invalidRefreshToken();
    }

    const nextRefreshToken = createOpaqueToken();
    const nextTokenHash = hashToken(nextRefreshToken);
    const nextExpiresAt = new Date(
      now.getTime() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    let rotated = false;
    try {
      rotated = await this.prisma.$transaction(async (transaction) => {
        const activeSession = await transaction.authSession.updateMany({
          where: {
            id: stored.sessionId,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { lastUsedAt: now, expiresAt: nextExpiresAt },
        });
        if (activeSession.count !== 1) return false;

        const consumed = await transaction.refreshToken.updateMany({
          where: { id: stored.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new RefreshRotationConflict();

        await transaction.refreshToken.create({
          data: {
            sessionId: stored.sessionId,
            tokenHash: nextTokenHash,
            expiresAt: nextExpiresAt,
          },
        });
        return true;
      });
    } catch (error) {
      if (!(error instanceof RefreshRotationConflict)) throw error;
    }

    if (!rotated) {
      const latest = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (latest?.consumedAt) {
        await this.revokeSessionAndAudit(
          stored.sessionId,
          stored.session.userId,
          metadata,
        );
      }
      throw invalidRefreshToken();
    }

    const tokens = await this.createAccessTokenPair(
      stored.session.user,
      stored.sessionId,
      nextRefreshToken,
    );
    await this.audit('refresh.rotated', stored.session.userId, metadata);
    return tokens;
  }

  async logout(
    refreshToken: string | undefined,
    sessionId: string | undefined,
    userId: string | undefined,
    metadata: RequestMetadata,
  ): Promise<void> {
    let targetSessionId = sessionId;
    let targetUserId = userId ?? null;
    if (refreshToken) {
      const token = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        select: { sessionId: true, session: { select: { userId: true } } },
      });
      if (token) {
        targetSessionId = token.sessionId;
        targetUserId = token.session.userId;
      }
    }

    if (targetSessionId) {
      await this.prisma.authSession.updateMany({
        where: { id: targetSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit('logout.completed', targetUserId, metadata);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const validPassword = user
      ? await argon2
          .verify(user.passwordHash, currentPassword)
          .catch(() => false)
      : false;
    if (!user || !validPassword) {
      throw new AuthError(
        400,
        'invalid_current_password',
        'Current password is incorrect.',
      );
    }

    const passwordHash = await argon2.hash(newPassword, passwordHashOptions);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    await this.audit('password.changed', userId, metadata);
  }

  async requestPasswordReset(
    email: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: publicUserSelect,
    });
    await this.audit('password_reset.requested', user?.id ?? null, metadata);
    if (user) {
      await this.sendOneTimeToken(
        user.id,
        user.email,
        OneTimeTokenPurpose.PASSWORD_RESET,
        this.config.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
      );
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const passwordHash = await argon2.hash(newPassword, passwordHashOptions);
    const now = new Date();
    const tokenHash = hashToken(token);
    const userId = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.oneTimeToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          purpose: true,
          expiresAt: true,
          consumedAt: true,
        },
      });
      if (
        !record ||
        record.purpose !== OneTimeTokenPurpose.PASSWORD_RESET ||
        record.consumedAt ||
        record.expiresAt <= now
      ) {
        return null;
      }

      const consumed = await transaction.oneTimeToken.updateMany({
        where: {
          id: record.id,
          purpose: OneTimeTokenPurpose.PASSWORD_RESET,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;

      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await transaction.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return record.userId;
    });

    if (!userId) throw invalidOneTimeToken();
    await this.audit('password_reset.completed', userId, metadata);
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new AuthError(404, 'session_not_found', 'Session not found.');
    }
    await this.audit('session.revoked', userId, metadata);
  }

  async activeSession(sessionId: string, userId: string) {
    return this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { emailVerifiedAt: { not: null } },
      },
      include: { user: { select: publicUserSelect } },
    });
  }

  async auditEvents(page: number, pageSize: number) {
    return this.prisma.authAuditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });
  }

  private async createSession(
    user: PublicUser,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const refreshToken = createOpaqueToken();
    const expiresAt = new Date(
      Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt,
        refreshTokens: {
          create: { tokenHash: hashToken(refreshToken), expiresAt },
        },
      },
      select: { id: true },
    });
    return this.createAccessTokenPair(user, session.id, refreshToken);
  }

  private async createAccessTokenPair(
    user: PublicUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<SessionTokens> {
    return {
      accessToken: await signAccessToken(user.id, sessionId, this.config),
      refreshToken,
      accessTokenExpiresIn: this.config.ACCESS_TOKEN_TTL_MINUTES * 60,
      sessionId,
      user,
    };
  }

  private async sendOneTimeToken(
    userId: string,
    email: string,
    purpose: OneTimeTokenPurpose,
    lifetimeMs: number,
  ): Promise<void> {
    const token = createOpaqueToken();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.oneTimeToken.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.oneTimeToken.create({
        data: {
          userId,
          purpose,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + lifetimeMs),
        },
      }),
    ]);

    const endpoint =
      purpose === OneTimeTokenPurpose.EMAIL_VERIFICATION
        ? '/api/v1/auth/email/verify'
        : '/api/v1/auth/password-reset/confirm';
    await this.mailer.send({
      to: email,
      subject:
        purpose === OneTimeTokenPurpose.EMAIL_VERIFICATION
          ? 'Verify your El-Sa3d account'
          : 'Reset your El-Sa3d password',
      text: `Use this single-use token with POST ${endpoint}: ${token}`,
    });
    await this.audit(
      purpose === OneTimeTokenPurpose.EMAIL_VERIFICATION
        ? 'email_verification.sent'
        : 'password_reset.sent',
      userId,
      { ipAddress: null, userAgent: null },
    );
  }

  private async revokeSessionAndAudit(
    sessionId: string,
    userId: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit('refresh.reuse_detected', userId, metadata);
  }

  private async audit(
    action: string,
    userId: string | null,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.authAuditEvent.create({
      data: {
        action,
        userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }
}

function invalidOneTimeToken(): AuthError {
  return new AuthError(
    400,
    'invalid_or_expired_token',
    'The token is invalid or expired.',
  );
}

function invalidRefreshToken(): AuthError {
  return new AuthError(
    401,
    'invalid_refresh_token',
    'Refresh token is invalid or expired.',
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

class RefreshRotationConflict extends Error {}
