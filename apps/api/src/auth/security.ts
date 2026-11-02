import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { SignJWT } from 'jose';
import type { AppConfig } from '@elsa3d/config';

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createCsrfToken(secret: string): string {
  const nonce = createOpaqueToken();
  const signature = createHmac('sha256', secret)
    .update(nonce)
    .digest('base64url');
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(token: string, secret: string): boolean {
  const [nonce, signature, extra] = token.split('.');
  if (!nonce || !signature || extra) return false;

  const expected = createHmac('sha256', secret).update(nonce).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function signAccessToken(
  userId: string,
  sessionId: string,
  config: AppConfig,
): Promise<string> {
  const secret = new TextEncoder().encode(config.ACCESS_TOKEN_SECRET);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('elsa3d-api')
    .setAudience('elsa3d-clients')
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret);
}
