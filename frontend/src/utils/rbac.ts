export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'user' | 'read_only';

export const Permissions = {
  // Super Admin only
  canManageTenants: (role?: string): boolean => role === 'super_admin',
  canSwitchTenants: (role?: string): boolean => role === 'super_admin',

  // Tenant Admin & Super Admin
  canManageUsers: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canViewUsers: (role?: string): boolean =>
    role === 'super_admin' || role === 'tenant_admin' || role === 'manager',
  canManageDomains: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canManageApiKeys: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canManageAbuse: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',

  // Operations (Manager, Tenant Admin, Super Admin, User)
  canCreateLinks: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canEditLinks: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canBulkCreate: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canRecordOutcomes: (role?: string): boolean =>
    role === 'super_admin' || role === 'tenant_admin' || role === 'manager',

  // Read Only Checks
  isReadOnly: (role?: string): boolean => role === 'read_only',
};

export function getRoleDisplayName(role?: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Administrator';
    case 'tenant_admin':
      return 'School Administrator';
    case 'manager':
      return 'Operations Manager';
    case 'user':
      return 'Staff Operator';
    case 'read_only':
      return 'Auditor (Read Only)';
    default:
      return role || 'User';
  }
}
