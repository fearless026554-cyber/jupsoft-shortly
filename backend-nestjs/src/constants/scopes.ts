// ============================================================================
// Canonical API Scopes & Role Hierarchy
// ============================================================================

export const ApiScopes = {
  WILDCARD: '*',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  LINKS_READ: 'links:read',
  LINKS_WRITE: 'links:write',
  ANALYTICS_READ: 'analytics:read',
  OUTCOMES_WRITE: 'outcomes:write',
  TENANTS_READ: 'tenants:read',
  TENANTS_WRITE: 'tenants:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
} as const;

export const DEFAULT_API_KEY_SCOPES = [
  ApiScopes.LINKS_READ,
  ApiScopes.LINKS_WRITE,
  ApiScopes.ANALYTICS_READ,
  ApiScopes.OUTCOMES_WRITE,
] as const;
