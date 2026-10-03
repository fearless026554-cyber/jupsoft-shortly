// ============================================================================
// Canonical Rate Limiting Thresholds
// ============================================================================

export const RATE_LIMITS = {
  STANDARD_RPM: 60,                // 60 req/min standard tenant rate limit
  INTERNAL_RPM: 600,               // 600 req/min Jupsoft internal service accounts
  WINDOW_SIZE_SEC: 60,
} as const;
