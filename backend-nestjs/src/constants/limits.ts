// ============================================================================
// Canonical Application Limits & Validation Bounds
// ============================================================================

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

export const BULK_LIMITS = {
  MAX_BATCH_SIZE: 10000,
} as const;

export const ABUSE_LIMITS = {
  MIN_REASON_LEN: 10,
} as const;

export const LINK_LIMITS = {
  MAX_ALIAS_LEN: 64,
  MAX_TAG_LEN: 64,
  MAX_EXTERNAL_REF_LEN: 128,
} as const;

export const REDIRECT_TYPES = ['302', '307'] as const;
export type RedirectType = (typeof REDIRECT_TYPES)[number];
