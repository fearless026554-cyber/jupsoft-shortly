import { ApiScopes } from './scopes.js';

export const UserRoles = {
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  MANAGER: 'manager',
  USER: 'user',
  READ_ONLY: 'read_only',
} as const;

export type UserRoleType = (typeof UserRoles)[keyof typeof UserRoles];
export const ALL_USER_ROLES = Object.values(UserRoles) as [UserRoleType, ...UserRoleType[]];

export const ROLE_SCOPES: Record<UserRoleType, string[]> = {
  [UserRoles.SUPER_ADMIN]: [ApiScopes.WILDCARD, ApiScopes.SUPER_ADMIN, ApiScopes.ADMIN],
  [UserRoles.TENANT_ADMIN]: [
    ApiScopes.ADMIN,
    ApiScopes.LINKS_READ,
    ApiScopes.LINKS_WRITE,
    ApiScopes.ANALYTICS_READ,
    ApiScopes.OUTCOMES_WRITE,
    ApiScopes.USERS_READ,
    ApiScopes.USERS_WRITE,
  ],
  [UserRoles.MANAGER]: [
    ApiScopes.LINKS_READ,
    ApiScopes.LINKS_WRITE,
    ApiScopes.ANALYTICS_READ,
    ApiScopes.OUTCOMES_WRITE,
    ApiScopes.USERS_READ,
  ],
  [UserRoles.USER]: [
    ApiScopes.LINKS_READ,
    ApiScopes.LINKS_WRITE,
    ApiScopes.ANALYTICS_READ,
  ],
  [UserRoles.READ_ONLY]: [
    ApiScopes.LINKS_READ,
    ApiScopes.ANALYTICS_READ,
    ApiScopes.USERS_READ,
  ],
};
