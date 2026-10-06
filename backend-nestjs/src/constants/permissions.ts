/**
 * Granular Permission Constants & Composable RBAC — Jupsoft Link Management Platform (JLMP)
 *
 * Granular permission scopes that map directly to UserRoles.
 * Each permission is a string constant: '<resource>.<action>'
 * New roles and feature entitlements can be composed without altering guards.
 */

import { UserRoles, UserRoleType } from './roles.js';

export const PERMISSIONS = {
  // Short Links & Redirects
  LINKS_CREATE: 'links.create',
  LINKS_READ: 'links.read',
  LINKS_UPDATE: 'links.update',
  LINKS_DELETE: 'links.delete',
  LINKS_BULK: 'links.bulk',
  LINKS_QR: 'links.qr',
  LINKS_EXPORT: 'links.export',

  // Analytics & Telemetry
  ANALYTICS_READ: 'analytics.read',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_REALTIME: 'analytics.realtime',

  // Outcomes & Conversions
  OUTCOMES_RECORD: 'outcomes.record',
  OUTCOMES_READ: 'outcomes.read',
  OUTCOMES_MANAGE: 'outcomes.manage',

  // Custom Domains & TRAI DLT
  DOMAINS_READ: 'domains.read',
  DOMAINS_CREATE: 'domains.create',
  DOMAINS_MANAGE: 'domains.manage',
  DOMAINS_DELETE: 'domains.delete',
  DOMAINS_DLT_SUBMIT: 'domains.dlt_submit',

  // Team & RBAC Management
  USERS_READ: 'users.read',
  USERS_INVITE: 'users.invite',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_RESET_PASSWORD: 'users.reset_password',

  // API Keys & Integrations
  API_KEYS_READ: 'api_keys.read',
  API_KEYS_CREATE: 'api_keys.create',
  API_KEYS_REVOKE: 'api_keys.revoke',

  // Abuse Quarantine & Security
  ABUSE_READ: 'abuse.read',
  ABUSE_MANAGE: 'abuse.manage',
  ABUSE_OVERRIDE: 'abuse.override',

  // Tenant Governance & Settings
  TENANT_READ: 'tenant.read',
  TENANT_MANAGE: 'tenant.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Numeric hierarchy score for authority comparisons.
 * Strict Rule: An actor can only manage (invite, modify, suspend, reset password, delete)
 * users strictly BELOW them in hierarchy.
 */
export const ROLE_HIERARCHY: Record<UserRoleType, number> = {
  [UserRoles.SUPER_ADMIN]: 100,
  [UserRoles.TENANT_ADMIN]: 80,
  [UserRoles.MANAGER]: 60,
  [UserRoles.USER]: 40,
  [UserRoles.READ_ONLY]: 20,
};

/**
 * Role-to-permissions mapping matrix.
 */
export const ROLE_PERMISSIONS: Record<UserRoleType, Permission[]> = {
  [UserRoles.SUPER_ADMIN]: Object.values(PERMISSIONS) as Permission[],

  [UserRoles.TENANT_ADMIN]: [
    PERMISSIONS.LINKS_CREATE,
    PERMISSIONS.LINKS_READ,
    PERMISSIONS.LINKS_UPDATE,
    PERMISSIONS.LINKS_DELETE,
    PERMISSIONS.LINKS_BULK,
    PERMISSIONS.LINKS_QR,
    PERMISSIONS.LINKS_EXPORT,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_REALTIME,
    PERMISSIONS.OUTCOMES_RECORD,
    PERMISSIONS.OUTCOMES_READ,
    PERMISSIONS.OUTCOMES_MANAGE,
    PERMISSIONS.DOMAINS_READ,
    PERMISSIONS.DOMAINS_CREATE,
    PERMISSIONS.DOMAINS_MANAGE,
    PERMISSIONS.DOMAINS_DELETE,
    PERMISSIONS.DOMAINS_DLT_SUBMIT,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_RESET_PASSWORD,
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_REVOKE,
    PERMISSIONS.ABUSE_READ,
    PERMISSIONS.ABUSE_MANAGE,
    PERMISSIONS.ABUSE_OVERRIDE,
    PERMISSIONS.TENANT_READ,
    PERMISSIONS.TENANT_MANAGE,
  ],

  [UserRoles.MANAGER]: [
    PERMISSIONS.LINKS_CREATE,
    PERMISSIONS.LINKS_READ,
    PERMISSIONS.LINKS_UPDATE,
    PERMISSIONS.LINKS_DELETE,
    PERMISSIONS.LINKS_BULK,
    PERMISSIONS.LINKS_QR,
    PERMISSIONS.LINKS_EXPORT,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_REALTIME,
    PERMISSIONS.OUTCOMES_RECORD,
    PERMISSIONS.OUTCOMES_READ,
    PERMISSIONS.DOMAINS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_RESET_PASSWORD,
    PERMISSIONS.ABUSE_READ,
  ],

  [UserRoles.USER]: [
    PERMISSIONS.LINKS_CREATE,
    PERMISSIONS.LINKS_READ,
    PERMISSIONS.LINKS_UPDATE,
    PERMISSIONS.LINKS_BULK,
    PERMISSIONS.LINKS_QR,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.OUTCOMES_READ,
  ],

  [UserRoles.READ_ONLY]: [
    PERMISSIONS.LINKS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.OUTCOMES_READ,
    PERMISSIONS.DOMAINS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ABUSE_READ,
    PERMISSIONS.TENANT_READ,
  ],
};

/**
 * Check if a role possesses a specific permission.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  if (role === UserRoles.SUPER_ADMIN) return true;
  const rolePerms = ROLE_PERMISSIONS[role as UserRoleType];
  return rolePerms ? rolePerms.includes(permission) : false;
}

/**
 * Get numerical level of a role.
 */
export function getRoleLevel(role?: string | null): number {
  if (!role) return 0;
  return ROLE_HIERARCHY[role as UserRoleType] || 10;
}

/**
 * Check whether an actor has authority to manage (edit, suspend, reset password) a target user.
 * Rules:
 * 1. Actor must be strictly higher in rank than target.
 * 2. Target of equal or higher rank is strictly READ-ONLY.
 * 3. Root super admin accounts cannot be managed by anyone below super_admin.
 */
export function canManageTargetUser(
  actorRole: string | undefined,
  targetRole: string | undefined,
  isTargetRootAccount = false,
  isSelf = false
): boolean {
  if (!actorRole || isTargetRootAccount || isSelf) return false;
  if (actorRole === UserRoles.SUPER_ADMIN) return true;

  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);

  return actorLevel > targetLevel;
}

/**
 * Check whether an actor has authority to delete a target user.
 * Rules:
 * 1. Only super_admin and tenant_admin have delete rights.
 * 2. Target must be strictly lower in rank.
 * 3. Self-deletion is strictly disallowed.
 * 4. Root super admin master account cannot be deleted.
 */
export function canDeleteTargetUser(
  actorRole: string | undefined,
  targetRole: string | undefined,
  isTargetRootAccount = false,
  isSelf = false
): boolean {
  if (isSelf || isTargetRootAccount) return false;
  if (actorRole !== UserRoles.SUPER_ADMIN && actorRole !== UserRoles.TENANT_ADMIN) return false;
  if (actorRole === UserRoles.SUPER_ADMIN) return true;

  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);

  return actorLevel > targetLevel;
}

/**
 * Returns allowed roles that the current actor can assign when inviting or modifying a user.
 */
export function getAllowedInviteRoles(actorRole: string | undefined): UserRoleType[] {
  if (actorRole === UserRoles.SUPER_ADMIN) {
    return [
      UserRoles.SUPER_ADMIN,
      UserRoles.TENANT_ADMIN,
      UserRoles.MANAGER,
      UserRoles.USER,
      UserRoles.READ_ONLY,
    ];
  }
  if (actorRole === UserRoles.TENANT_ADMIN) {
    return [UserRoles.MANAGER, UserRoles.USER, UserRoles.READ_ONLY];
  }
  if (actorRole === UserRoles.MANAGER) {
    return [UserRoles.USER, UserRoles.READ_ONLY];
  }
  return [];
}
