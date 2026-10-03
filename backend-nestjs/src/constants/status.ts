// ============================================================================
// Canonical Status Enums & System Route Constants
// ============================================================================

export const LinkStatus = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ARCHIVED: 'archived',
  BLOCKED: 'blocked',
  EXPIRED: 'expired',
} as const;

export type LinkStatusType = (typeof LinkStatus)[keyof typeof LinkStatus];
export const ALL_LINK_STATUSES = Object.values(LinkStatus) as [LinkStatusType, ...LinkStatusType[]];
export const PATCHABLE_LINK_STATUSES = [
  LinkStatus.ACTIVE,
  LinkStatus.DISABLED,
  LinkStatus.ARCHIVED,
] as const;
export type PatchableLinkStatusType = (typeof PATCHABLE_LINK_STATUSES)[number];

export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
} as const;

export type TenantStatusType = (typeof TenantStatus)[keyof typeof TenantStatus];
export const ALL_TENANT_STATUSES = Object.values(TenantStatus) as [TenantStatusType, ...TenantStatusType[]];

export const UserStatus = {
  ACTIVE: 'active',
  INVITED: 'invited',
  SUSPENDED: 'suspended',
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];
export const ALL_USER_STATUSES = Object.values(UserStatus) as [UserStatusType, ...UserStatusType[]];

export const DomainStatus = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  FAILED: 'failed',
} as const;

export const DltStatus = {
  WHITELISTED: 'whitelisted',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const;

export const ScreeningProvider = {
  HEURISTICS_SAFE_BROWSING: 'heuristics_safe_browsing',
  PERIODIC_SAFE_BROWSING: 'periodic_safe_browsing',
  GOOGLE_SAFE_BROWSING: 'google_safe_browsing',
} as const;

export type ScreeningProviderType = (typeof ScreeningProvider)[keyof typeof ScreeningProvider];

export const ScreeningVerdict = {
  PENDING: 'pending',
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  PHISHING: 'phishing',
  MALWARE: 'malware',
  SERVICE_UNAVAILABLE: 'service_unavailable',
} as const;

export type ScreeningVerdictType = (typeof ScreeningVerdict)[keyof typeof ScreeningVerdict];

export const SYSTEM_ROUTES = {
  UNAVAILABLE: '/system/unavailable',
  EXPIRED: '/system/expired',
} as const;

export const BULK_CONSTANTS = {
  PROGRESS_INTERVAL: 100,
  CLONE_TAG_SUFFIX: '_clone',
  CLONE_DEFAULT_TAG: 'clone',
  FALLBACK_TENANT_CODE: 't',
} as const;

export const LINK_CONSTANTS = {
  SHORT_CODE_ALPHABET: '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
  ALIAS_REGEX: /^[a-z0-9-_]{3,64}$/,
  ALIAS_MIN_LEN: 3,
  ALIAS_MAX_LEN: 64,
} as const;
