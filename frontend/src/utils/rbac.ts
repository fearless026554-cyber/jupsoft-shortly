// ============================================================================
// Enterprise RBAC (Role-Based Access Control) & Composable Entitlements Matrix
// Jupsoft Shortly Link Management Platform (JLMP)
// Architecture inspired by Jupsoft Centralized Multi-Tenant Core
// ============================================================================

export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'user' | 'read_only';

export interface RoleDefinition {
  role: UserRole;
  title: string;
  badge: string;
  level: number;
  scope: 'Global Scope' | 'Tenant Scope';
  colorClasses: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  };
  description: string;
  responsibilities: string[];
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  tenant_admin: 80,
  manager: 60,
  user: 40,
  read_only: 20,
};

export const ALL_ROLES: UserRole[] = [
  'super_admin',
  'tenant_admin',
  'manager',
  'user',
  'read_only',
];

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  super_admin: {
    role: 'super_admin',
    title: 'Super Administrator',
    badge: 'Super Admin',
    level: 100,
    scope: 'Global Scope',
    colorClasses: {
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      badgeBg: 'bg-purple-100 dark:bg-purple-900/60',
      badgeText: 'text-purple-800 dark:text-purple-200',
      badgeBorder: 'border-purple-300 dark:border-purple-700',
    },
    description: 'Master platform administrator with unrestricted global authority across all tenants, domains, and security controls.',
    responsibilities: [
      'Multi-tenant creation and global workspace provisioning',
      'Global security policy and abuse blacklist governance',
      'System-wide role delegations and root master account management',
      'Infrastructure rate-limiting and audit log monitoring',
    ],
  },
  tenant_admin: {
    role: 'tenant_admin',
    title: 'Tenant Administrator',
    badge: 'Tenant Admin',
    level: 80,
    scope: 'Tenant Scope',
    colorClasses: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
      badgeText: 'text-blue-800 dark:text-blue-200',
      badgeBorder: 'border-blue-300 dark:border-blue-700',
    },
    description: 'Full organization owner with comprehensive authority over custom domains, DLT whitelisting, team members, and API credentials.',
    responsibilities: [
      'Custom vanity domain DNS verification and SSL lifecycle',
      'TRAI DLT compliance submission and template management',
      'Team member invitations, role updates, and password resets',
      'Tenant API key creation, rotation, and revocation',
    ],
  },
  manager: {
    role: 'manager',
    title: 'Operations Manager',
    badge: 'Manager',
    level: 60,
    scope: 'Tenant Scope',
    colorClasses: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      badgeText: 'text-emerald-800 dark:text-emerald-200',
      badgeBorder: 'border-emerald-300 dark:border-emerald-700',
    },
    description: 'Operational team lead managing link creation, bulk ingestion pipelines, campaign attribution, and team performance.',
    responsibilities: [
      'High-volume bulk CSV link generation and tag segmentation',
      'Conversion tracking, outcome valuation, and revenue attribution',
      'Real-time traffic telemetry and CSV reporting exports',
      'Operator onboarding and team member coordination',
    ],
  },
  user: {
    role: 'user',
    title: 'Staff Operator',
    badge: 'Operator',
    level: 40,
    scope: 'Tenant Scope',
    colorClasses: {
      bg: 'bg-slate-50 dark:bg-slate-900/50',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeText: 'text-slate-800 dark:text-slate-200',
      badgeBorder: 'border-slate-300 dark:border-slate-600',
    },
    description: 'Standard campaign creator focused on everyday short link authoring, custom vanity aliases, and branded QR codes.',
    responsibilities: [
      'Create and manage branded short links with custom aliases',
      'Generate branded QR codes with custom styling and logos',
      'Monitor basic click analytics for authored links',
      'Manage routing expirations and max click limits',
    ],
  },
  read_only: {
    role: 'read_only',
    title: 'Auditor & Compliance',
    badge: 'Auditor (Read-Only)',
    level: 20,
    scope: 'Tenant Scope',
    colorClasses: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
      badgeText: 'text-amber-800 dark:text-amber-200',
      badgeBorder: 'border-amber-300 dark:border-amber-700',
    },
    description: 'Read-only observer for compliance, regulatory audit, and executive reporting without modification permissions.',
    responsibilities: [
      'Inspect short link configurations and destinations without editing',
      'View aggregated click analytics, traffic sources, and geo data',
      'Audit custom domain verification and TRAI DLT registration status',
      'Verify threat screening logs and quarantine compliance',
    ],
  },
};

// ============================================================================
// Granular Permission Matrix (RBAC Entitlements Grid)
// ============================================================================

export interface RBACPermission {
  id: string;
  category: string;
  label: string;
  description: string;
  allowedRoles: UserRole[];
}

export const PERMISSIONS_MATRIX: RBACPermission[] = [
  // 1. Short Links & Redirects
  {
    id: 'links.create',
    category: 'Short Links & Redirects',
    label: 'Create Single Short Link',
    description: 'Create new short links with custom aliases and expiration',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user'],
  },
  {
    id: 'links.read',
    category: 'Short Links & Redirects',
    label: 'View Links & Metadata',
    description: 'Inspect short link details, target URLs, and metadata',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user', 'read_only'],
  },
  {
    id: 'links.update',
    category: 'Short Links & Redirects',
    label: 'Edit Link Destinations & Tags',
    description: 'Modify target destinations, aliases, tags, and status',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user'],
  },
  {
    id: 'links.delete',
    category: 'Short Links & Redirects',
    label: 'Archive & Delete Links',
    description: 'Soft-delete or permanently purge short links from routing',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'links.bulk',
    category: 'Short Links & Redirects',
    label: 'Bulk CSV Ingestion (10,000+)',
    description: 'Upload high-volume batch CSV files with asynchronous workers',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user'],
  },
  {
    id: 'links.qr',
    category: 'Short Links & Redirects',
    label: 'Generate Branded QR Codes',
    description: 'Create vector SVG and PNG QR codes with color styling',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user'],
  },

  // 2. Analytics & Telemetry
  {
    id: 'analytics.read',
    category: 'Analytics & Telemetry',
    label: 'View Analytics Dashboards',
    description: 'Access aggregated clicks, geo maps, browsers, and devices',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user', 'read_only'],
  },
  {
    id: 'analytics.export',
    category: 'Analytics & Telemetry',
    label: 'Export Detailed Traffic CSVs',
    description: 'Download raw click event logs with referrers and timestamps',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'analytics.realtime',
    category: 'Analytics & Telemetry',
    label: 'Live Realtime Stream',
    description: 'Monitor high-frequency real-time click feed via SSE sockets',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },

  // 3. Outcomes & Conversions
  {
    id: 'outcomes.record',
    category: 'Outcomes & Conversions',
    label: 'Record Conversions & Revenue',
    description: 'Post webhook or manual conversion milestones to short links',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'outcomes.read',
    category: 'Outcomes & Conversions',
    label: 'Inspect Outcome Metrics',
    description: 'View ROI, conversion rates, and revenue performance charts',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'user', 'read_only'],
  },

  // 4. Custom Domains & TRAI DLT
  {
    id: 'domains.read',
    category: 'Custom Domains & TRAI DLT',
    label: 'View Registered Domains',
    description: 'Inspect custom domains, DNS verification, and SSL health',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'read_only'],
  },
  {
    id: 'domains.manage',
    category: 'Custom Domains & TRAI DLT',
    label: 'Add & Verify Custom Domains',
    description: 'Provision vanity domains, configure CNAME records, and SSL',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },
  {
    id: 'domains.dlt_submit',
    category: 'Custom Domains & TRAI DLT',
    label: 'TRAI DLT Whitelisting Workflow',
    description: 'Submit enterprise Header IDs and Template IDs for SMS compliance',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },

  // 5. Team & RBAC Management
  {
    id: 'users.read',
    category: 'Team & RBAC Management',
    label: 'View Team Directory',
    description: 'View team members, role assignments, and activity logs',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'read_only'],
  },
  {
    id: 'users.invite',
    category: 'Team & RBAC Management',
    label: 'Invite Team Members',
    description: 'Create new operator accounts with initial credentials',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'users.update',
    category: 'Team & RBAC Management',
    label: 'Modify Member Roles & Status',
    description: 'Change subordinate member roles, activate or suspend access',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'users.reset_password',
    category: 'Team & RBAC Management',
    label: 'Reset User Passwords',
    description: 'Generate temporary passwords for subordinate accounts',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager'],
  },
  {
    id: 'users.delete',
    category: 'Team & RBAC Management',
    label: 'Delete User Accounts',
    description: 'Permanently remove subordinate team members from the organization',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },

  // 6. Abuse Quarantine & Security
  {
    id: 'abuse.read',
    category: 'Abuse Quarantine & Security',
    label: 'View Threat & Safe Browsing Logs',
    description: 'Inspect phishing, malware, and flagged link quarantine queues',
    allowedRoles: ['super_admin', 'tenant_admin', 'manager', 'read_only'],
  },
  {
    id: 'abuse.manage',
    category: 'Abuse Quarantine & Security',
    label: 'Enforce Killswitch & Quarantines',
    description: 'Instantly block malicious links and quarantine suspicious traffic',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },

  // 7. API Keys & Integrations
  {
    id: 'api_keys.read',
    category: 'API Keys & Integrations',
    label: 'View API Credentials',
    description: 'View active API key prefixes, scopes, and last used times',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },
  {
    id: 'api_keys.manage',
    category: 'API Keys & Integrations',
    label: 'Generate & Revoke API Keys',
    description: 'Issue new production API keys and immediately revoke compromised keys',
    allowedRoles: ['super_admin', 'tenant_admin'],
  },

  // 8. Tenant & Multi-Tenancy Governance
  {
    id: 'tenant.manage',
    category: 'Tenant Governance',
    label: 'Organization Settings & Plans',
    description: 'Manage tenant details, rate limit plans, and global switchboard',
    allowedRoles: ['super_admin'],
  },
];

// ============================================================================
// Helper Utilities & Hierarchical Security Rules
// ============================================================================

export function getRoleLevel(role?: string | null): number {
  if (!role) return 0;
  return ROLE_HIERARCHY[role as UserRole] || 10;
}

export function getRoleDisplayName(role?: string): string {
  if (!role) return 'User';
  return ROLE_DEFINITIONS[role as UserRole]?.title || role;
}

export function getRoleConfig(role?: string): RoleDefinition {
  return (
    ROLE_DEFINITIONS[role as UserRole] || {
      role: 'user',
      title: role || 'Operator',
      badge: role || 'Operator',
      level: 40,
      scope: 'Tenant Scope',
      colorClasses: {
        bg: 'bg-slate-50 dark:bg-slate-900',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
        badgeBg: 'bg-slate-100 dark:bg-slate-800',
        badgeText: 'text-slate-800 dark:text-slate-200',
        badgeBorder: 'border-slate-300 dark:border-slate-600',
      },
      description: 'Standard team operator account.',
      responsibilities: ['Standard short link management'],
    }
  );
}

export function hasPermission(role: string | undefined, permissionId: string): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  const perm = PERMISSIONS_MATRIX.find((p) => p.id === permissionId);
  return perm ? perm.allowedRoles.includes(role as UserRole) : false;
}

export function isRootSuperAdminAccount(user?: { email?: string; name?: string; role?: string } | null): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const name = (user.name || '').toLowerCase().trim();
  return (
    email === 'admin@jupsoft.com' ||
    email === 'sachin@jupsoft.com' ||
    email === 'superadmin@jupsoft.com' ||
    name.includes('sachin sharma')
  );
}

export const isRootSuperAdmin = isRootSuperAdminAccount;
export const ALL_ENTITLEMENTS = PERMISSIONS_MATRIX;
export const getRoleDefinition = getRoleConfig;

export function getRolePermissions(role?: string): RBACPermission[] {
  if (!role) return [];
  if (role === 'super_admin') return PERMISSIONS_MATRIX;
  return PERMISSIONS_MATRIX.filter((p) => p.allowedRoles.includes(role as UserRole));
}

/**
 * Checks if the actor can manage (edit role, suspend/activate, reset password) a target user.
 * Rule: An actor can only manage users strictly BELOW them in rank. Equal or higher is read-only.
 */
export function canManageTargetUser(
  actorRole: string | undefined,
  targetRole: string | undefined,
  isTargetRoot = false,
  isSelf = false
): boolean {
  if (!actorRole || isTargetRoot || isSelf) return false;
  if (actorRole === 'super_admin') return true;

  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);

  return actorLevel > targetLevel;
}

/**
 * Checks if the actor can delete a target user.
 * Rule:
 * 1. Only super_admin and tenant_admin can delete.
 * 2. Target must be strictly lower in rank.
 * 3. Self cannot be deleted.
 * 4. Root super admin account is permanently protected.
 */
export function canDeleteTargetUser(
  actorRole: string | undefined,
  targetRole: string | undefined,
  isTargetRoot = false,
  isSelf = false
): boolean {
  if (isSelf || isTargetRoot) return false;
  if (actorRole !== 'super_admin' && actorRole !== 'tenant_admin') return false;
  if (actorRole === 'super_admin') return true;

  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);

  return actorLevel > targetLevel;
}

/**
 * Returns allowed roles that the current user can assign when inviting or updating a user.
 */
export function getAllowedInviteRoles(actorRole: string | undefined): UserRole[] {
  if (actorRole === 'super_admin') {
    return ['super_admin', 'tenant_admin', 'manager', 'user', 'read_only'];
  }
  if (actorRole === 'tenant_admin') {
    return ['manager', 'user', 'read_only'];
  }
  if (actorRole === 'manager') {
    return ['user', 'read_only'];
  }
  return [];
}

/**
 * Generates an enterprise-strength temporary password using cryptographically secure random values (CSPRNG).
 */
export function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const specials = '!@#$%&*';
  const randomBuffer = new Uint32Array(6);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBuffer);
  } else {
    for (let i = 0; i < 6; i++) {
      randomBuffer[i] = Math.floor(Math.random() * 1000000);
    }
  }

  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(randomBuffer[i] % chars.length);
  }
  const spec = specials.charAt(randomBuffer[4] % specials.length);
  const num = 1000 + (randomBuffer[5] % 9000);
  return `Shortly@${num}${spec}${rand}`;
}

/**
 * Legacy Permissions shim for existing call-sites
 */
export const Permissions = {
  canManageTenants: (role?: string): boolean => role === 'super_admin',
  canSwitchTenants: (role?: string): boolean => role === 'super_admin',
  canManageUsers: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canViewUsers: (role?: string): boolean =>
    role === 'super_admin' || role === 'tenant_admin' || role === 'manager',
  canManageDomains: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canManageApiKeys: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canManageAbuse: (role?: string): boolean => role === 'super_admin' || role === 'tenant_admin',
  canCreateLinks: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canEditLinks: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canBulkCreate: (role?: string): boolean => Boolean(role && role !== 'read_only'),
  canRecordOutcomes: (role?: string): boolean =>
    role === 'super_admin' || role === 'tenant_admin' || role === 'manager',
  isReadOnly: (role?: string): boolean => role === 'read_only',
};
