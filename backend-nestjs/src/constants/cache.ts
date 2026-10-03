// ============================================================================
// Canonical Cache TTLs (Seconds)
// ============================================================================

export const CACHE_TTL = {
  LINK_METADATA_SEC: 86400,        // 24 Hours: Active link resolution
  DOMAIN_METADATA_SEC: 604800,     // 7 Days: Domain routing & DLT status
  TENANT_STATUS_SEC: 3600,         // 1 Hour: Tenant suspension verification
  AUTH_SESSION_SEC: 300,           // 5 Minutes: Authenticated API key session
  IDEMPOTENCY_SEC: 86400,          // 24 Hours: Duplicate request prevention
  VISITOR_SALT_SEC: 172800,        // 48 Hours: DPDP cryptographic salt
} as const;
