import type { AccountRole } from '../generated/prisma/enums.js';

export const permissionsByRole: Record<AccountRole, readonly string[]> = {
  CUSTOMER: [
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'catalog:read',
    'search:read',
  ],
  ADMIN: [
    'profile:read',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'auth:audit:read',
    'users:roles:manage',
    'catalog:read',
    'catalog:write',
    'inventory:read',
    'inventory:write',
    'search:read',
  ],
  PHARMACIST: [
    'profile:read',
    'auth:sessions:read',
    'prescriptions:verify',
    'catalog:read',
    'catalog:write',
    'inventory:read',
    'inventory:write',
    'search:read',
  ],
  DELIVERY_AGENT: ['profile:read', 'auth:sessions:read', 'deliveries:update'],
};

export function hasPermissions(
  role: AccountRole,
  requiredPermissions: readonly string[],
): boolean {
  const granted = new Set(permissionsByRole[role]);
  return requiredPermissions.every((permission) => granted.has(permission));
}
