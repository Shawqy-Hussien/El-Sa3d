import type { AccountRole } from '../generated/prisma/enums.js';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  role: AccountRole;
  emailVerified: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPrincipal;
  }
}
