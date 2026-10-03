// ============================================================================
// Canonical Application Fallbacks & Retention Policy
// ============================================================================

export const RETENTION_POLICY = {
  RAW_CLICKS_MAX_AGE_MONTHS: 13,   // DPDP Act / Storage policy
} as const;

export const FALLBACKS = {
  COUNTRY_CODE: 'XX',              // ISO 3166-1 user-assigned code for Unknown
  REFERRER: 'direct',
  REDIRECT_TYPE: 302 as const,
  SHORT_CODE_DEFAULT_LENGTH: 6,
  SHORT_CODE_MAX_COLLISION_LENGTH: 7,
  SHORT_CODE_MAX_RETRIES: 3,
} as const;
