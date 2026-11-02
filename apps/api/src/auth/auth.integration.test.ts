import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { parseConfig } from '@elsa3d/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AccountRole, PrismaClient } from '../generated/prisma/client.js';
import { createApp } from '../app.js';
import { createAuthRouter, type AuthRateLimits } from './router.js';
import type { MailMessage, Mailer } from './mailer.js';
import { hashToken } from './security.js';

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Start PostgreSQL and apply migrations before tests.',
  );
}

const testRunId = randomUUID();
const testUserAgent = `auth-integration-${testRunId}`;
const testEmailPrefix = `auth-${testRunId}-`;
const testPassword = 'CorrectHorse2026!';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const config = parseConfig({
  API_PORT: '3001',
  DATABASE_URL: databaseUrl,
  ACCESS_TOKEN_SECRET: 'integration-test-secret-with-more-than-32-characters',
  COOKIE_SECURE: 'true',
  MAIL_TRANSPORT: 'console',
  WEB_ORIGINS: 'http://localhost:5173',
});

class TestMailer implements Mailer {
  messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  latest(to: string, subjectPrefix: string): MailMessage {
    const message = this.messages
      .filter(
        (candidate) =>
          candidate.to === to && candidate.subject.startsWith(subjectPrefix),
      )
      .at(-1);
    assert.ok(message, `Expected ${subjectPrefix} mail for ${to}`);
    return message;
  }
}

const mailer = new TestMailer();

before(async () => {
  await prisma.$connect();
});

after(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: testEmailPrefix } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.authAuditEvent.deleteMany({
    where: { OR: [{ userAgent: testUserAgent }, { userId: { in: userIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('registration creates a customer and stores only a hashed, single-use verification token', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    const response = await post(server.url, '/auth/register', {
      email,
      password: testPassword,
      role: 'ADMIN',
    });
    assert.equal(response.status, 400);

    const accepted = await post(server.url, '/auth/register', {
      email,
      password: testPassword,
    });
    assert.equal(accepted.status, 202);
    assert.equal(
      (await accepted.json()).message,
      'If the request can be completed, instructions will be sent to the provided address.',
    );

    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user);
    assert.equal(user.role, AccountRole.CUSTOMER);
    assert.equal(user.emailVerifiedAt, null);

    const token = tokenFrom(mailer.latest(email, 'Verify'));
    const stored = await prisma.oneTimeToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, token);

    const verified = await post(server.url, '/auth/email/verify', { token });
    assert.equal(verified.status, 204);
    const replay = await post(server.url, '/auth/email/verify', { token });
    assert.equal(replay.status, 400);
    assert.ok(
      (await prisma.user.findUnique({ where: { email } }))?.emailVerifiedAt,
    );
  } finally {
    await server.close();
  }
});

test('login issues an access token and a server-stored hashed refresh token', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const response = await post(server.url, '/auth/login', {
      email,
      password: testPassword,
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.tokenType, 'Bearer');
    assert.ok(typeof result.accessToken === 'string');
    assert.ok(typeof result.refreshToken === 'string');
    assert.equal(result.user.email, email);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(result.refreshToken) },
    });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, result.refreshToken);
  } finally {
    await server.close();
  }
});

test('login returns the same generic error for unknown users and incorrect passwords', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const wrongPassword = await post(server.url, '/auth/login', {
      email,
      password: 'IncorrectHorse2026!',
    });
    const unknownUser = await post(server.url, '/auth/login', {
      email: newEmail(),
      password: testPassword,
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownUser.json());
  } finally {
    await server.close();
  }
});

test('refresh rotation consumes the old token and reuse revokes the whole session', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const login = await loginUser(server.url, email);
    const rotatedResponse = await post(server.url, '/auth/refresh', {
      refreshToken: login.refreshToken,
    });
    assert.equal(rotatedResponse.status, 200);
    const rotated = await rotatedResponse.json();
    assert.notEqual(rotated.refreshToken, login.refreshToken);

    const previous = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(login.refreshToken) },
    });
    assert.ok(previous?.consumedAt);

    const reuse = await post(server.url, '/auth/refresh', {
      refreshToken: login.refreshToken,
    });
    assert.equal(reuse.status, 401);
    const session = await prisma.authSession.findUnique({
      where: { id: login.sessionId },
    });
    assert.ok(session?.revokedAt);

    const authenticated = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${rotated.accessToken}`,
    });
    assert.equal(authenticated.status, 401);
  } finally {
    await server.close();
  }
});

test('logout revokes the refresh session and invalidates access tokens immediately', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const tokens = await loginUser(server.url, email);
    const response = await post(server.url, '/auth/logout', {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(response.status, 204);

    const refresh = await post(server.url, '/auth/refresh', {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(refresh.status, 401);
    const sessions = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${tokens.accessToken}`,
    });
    assert.equal(sessions.status, 401);
  } finally {
    await server.close();
  }
});

test('password reset is generic, single-use, and revokes existing sessions', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const activeTokens = await loginUser(server.url, email);
    const existing = await post(server.url, '/auth/password-reset/request', {
      email,
    });
    const missing = await post(server.url, '/auth/password-reset/request', {
      email: newEmail(),
    });
    assert.equal(existing.status, 202);
    assert.equal(missing.status, 202);
    assert.deepEqual(await existing.json(), await missing.json());

    const token = tokenFrom(mailer.latest(email, 'Reset'));
    const stored = await prisma.oneTimeToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, token);

    const nextPassword = 'DifferentHorse2026!';
    const reset = await post(server.url, '/auth/password-reset/confirm', {
      token,
      password: nextPassword,
    });
    assert.equal(reset.status, 204);
    const replay = await post(server.url, '/auth/password-reset/confirm', {
      token,
      password: testPassword,
    });
    assert.equal(replay.status, 400);

    const oldAccess = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${activeTokens.accessToken}`,
    });
    assert.equal(oldAccess.status, 401);
    const oldLogin = await post(server.url, '/auth/login', {
      email,
      password: testPassword,
    });
    assert.equal(oldLogin.status, 401);
    const newLogin = await post(server.url, '/auth/login', {
      email,
      password: nextPassword,
    });
    assert.equal(newLogin.status, 200);
  } finally {
    await server.close();
  }
});

test('change password and session listing/revocation are scoped to the current user', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const first = await loginUser(server.url, email);
    const second = await loginUser(server.url, email);
    const sessions = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${first.accessToken}`,
    });
    assert.equal(sessions.status, 200);
    const records = (await sessions.json()).sessions as Array<{
      id: string;
      current: boolean;
    }>;
    assert.equal(records.length, 2);
    assert.ok(
      records.some(
        (session) => session.id === first.sessionId && session.current,
      ),
    );

    const revoke = await post(
      server.url,
      `/auth/sessions/${second.sessionId}/revoke`,
      {},
      { authorization: `Bearer ${first.accessToken}` },
    );
    assert.equal(revoke.status, 204);
    const revokedAccess = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${second.accessToken}`,
    });
    assert.equal(revokedAccess.status, 401);

    const changed = await post(
      server.url,
      '/auth/change-password',
      { currentPassword: testPassword, newPassword: 'ChangedHorse2026!' },
      { authorization: `Bearer ${first.accessToken}` },
    );
    assert.equal(changed.status, 204);
    const oldAccess = await get(server.url, '/auth/sessions', {
      authorization: `Bearer ${first.accessToken}`,
    });
    assert.equal(oldAccess.status, 401);
    assert.equal(
      (
        await post(server.url, '/auth/login', {
          email,
          password: 'ChangedHorse2026!',
        })
      ).status,
      200,
    );
  } finally {
    await server.close();
  }
});

test('authorization requires both an allowed role and the required permission', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    await registerAndVerify(server.url, email);
    const customer = await loginUser(server.url, email);
    const customerDenied = await get(
      server.url,
      '/auth/admin/auth-audit-events',
      {
        authorization: `Bearer ${customer.accessToken}`,
      },
    );
    assert.equal(customerDenied.status, 403);

    await prisma.user.update({
      where: { email },
      data: { role: AccountRole.PHARMACIST },
    });
    const pharmacistDenied = await get(
      server.url,
      '/auth/admin/auth-audit-events',
      {
        authorization: `Bearer ${customer.accessToken}`,
      },
    );
    assert.equal(pharmacistDenied.status, 403);

    await prisma.user.update({
      where: { email },
      data: { role: AccountRole.ADMIN },
    });
    const adminAllowed = await get(
      server.url,
      '/auth/admin/auth-audit-events',
      {
        authorization: `Bearer ${customer.accessToken}`,
      },
    );
    assert.equal(adminAllowed.status, 200);
  } finally {
    await server.close();
  }
});

test('login rate limits repeated credential failures', async () => {
  const email = newEmail();
  const server = await startServer({
    login: 2,
    standard: 100,
    reset: 100,
    windowMs: 60_000,
  });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal(
        (
          await post(server.url, '/auth/login', {
            email,
            password: testPassword,
          })
        ).status,
        401,
      );
    }
    const limited = await post(server.url, '/auth/login', {
      email,
      password: testPassword,
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error, 'too_many_requests');
  } finally {
    await server.close();
  }
});

test('cookie auth is HttpOnly, Secure, SameSite and rejects missing CSRF tokens', async () => {
  const email = newEmail();
  const server = await startServer();
  try {
    const csrfResponse = await fetch(`${server.url}/auth/csrf`);
    assert.equal(csrfResponse.status, 200);
    const csrfToken = (await csrfResponse.json()).csrfToken as string;
    const csrfCookie = findCookie(
      csrfResponse.headers.getSetCookie(),
      'csrf_token',
    );
    assert.match(csrfCookie, /Secure/i);
    assert.match(csrfCookie, /SameSite=Lax/i);
    assert.doesNotMatch(csrfCookie, /HttpOnly/i);

    const cookieHeaders = {
      cookie: cookiePair(csrfCookie),
      'x-auth-transport': 'cookie',
      'x-csrf-token': csrfToken,
    };
    const missingCsrf = await post(
      server.url,
      '/auth/register',
      { email, password: testPassword },
      { cookie: cookiePair(csrfCookie), 'x-auth-transport': 'cookie' },
    );
    assert.equal(missingCsrf.status, 403);

    const registered = await post(
      server.url,
      '/auth/register',
      { email, password: testPassword },
      cookieHeaders,
    );
    assert.equal(registered.status, 202);
    const verification = tokenFrom(mailer.latest(email, 'Verify'));
    assert.equal(
      (await post(server.url, '/auth/email/verify', { token: verification }))
        .status,
      204,
    );

    const loginResponse = await post(
      server.url,
      '/auth/login',
      { email, password: testPassword },
      cookieHeaders,
    );
    assert.equal(loginResponse.status, 200);
    const loginBody = await loginResponse.json();
    assert.equal('accessToken' in loginBody, false);
    assert.equal('refreshToken' in loginBody, false);
    const cookies = loginResponse.headers.getSetCookie();
    const accessCookie = findCookie(cookies, 'access_token');
    const refreshCookie = findCookie(cookies, 'refresh_token');
    for (const cookie of [accessCookie, refreshCookie]) {
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, /Path=\/api\/v1/i);
    }

    const sessionCookie = `${cookiePair(csrfCookie)}; ${cookiePair(accessCookie)}; ${cookiePair(refreshCookie)}`;
    const sessions = await get(server.url, '/auth/sessions', {
      cookie: sessionCookie,
      'x-auth-transport': 'cookie',
    });
    assert.equal(sessions.status, 200);
  } finally {
    await server.close();
  }
});

async function startServer(rateLimits?: Partial<AuthRateLimits>) {
  const app = createApp({
    checkDatabase: async () => {},
    authRouter: createAuthRouter({ prisma, config, mailer, rateLimits }),
    webOrigins: config.WEB_ORIGINS,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    url: `http://127.0.0.1:${address.port}/api/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function registerAndVerify(
  baseUrl: string,
  email: string,
): Promise<void> {
  const registration = await post(baseUrl, '/auth/register', {
    email,
    password: testPassword,
  });
  assert.equal(registration.status, 202);
  const token = tokenFrom(mailer.latest(email, 'Verify'));
  const verification = await post(baseUrl, '/auth/email/verify', { token });
  assert.equal(verification.status, 204);
}

async function loginUser(baseUrl: string, email: string) {
  const response = await post(baseUrl, '/auth/login', {
    email,
    password: testPassword,
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }>;
}

async function post(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': testUserAgent,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function get(
  baseUrl: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'user-agent': testUserAgent, ...headers },
  });
}

function newEmail(): string {
  return `${testEmailPrefix}${randomUUID()}@example.test`;
}

function tokenFrom(message: MailMessage): string {
  const match = message.text.match(/: ([A-Za-z0-9_-]{32,})$/);
  assert.ok(match, 'Expected one-time token in test mail');
  return match[1];
}

function findCookie(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `Expected ${name} Set-Cookie header`);
  return cookie;
}

function cookiePair(cookie: string): string {
  return cookie.split(';', 1)[0];
}
