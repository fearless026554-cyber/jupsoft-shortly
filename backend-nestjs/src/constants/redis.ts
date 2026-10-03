// ============================================================================
// Canonical Redis Client & Connection Constants
// ============================================================================

export const REDIS_CONFIG = {
  MAX_RETRIES: 5,
  RETRY_BASE_MS: 100,
  RETRY_CAP_MS: 3000,
  RATE_LIMIT_KEY_GRACE_SEC: 5,
} as const;
