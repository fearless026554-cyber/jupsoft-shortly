// ============================================================================
// Canonical User Roles
// ============================================================================

export const UserRoles = {
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  MANAGER: 'manager',
  USER: 'user',
  READ_ONLY: 'read_only',
} as const;

export type UserRoleType = (typeof UserRoles)[keyof typeof UserRoles];
export const ALL_USER_ROLES = Object.values(UserRoles) as [UserRoleType, ...UserRoleType[]];
