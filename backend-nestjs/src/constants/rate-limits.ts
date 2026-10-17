// ============================================================================
// Canonical Rate Limiting Thresholds
// ============================================================================

export const RATE_LIMITS = {
  DEFAULT_API_KEY_RPM: 10,         // 10 req/min default per-key rate limit
  STANDARD_RPM: 60,                // 60 req/min standard tenant rate limit
  INTERNAL_RPM: 600,               // 600 req/min Jupsoft internal service accounts
  REDIRECT_RPM: 300,               // 300 req/min per IP on redirect endpoints
  WINDOW_SIZE_SEC: 60,
} as const;
