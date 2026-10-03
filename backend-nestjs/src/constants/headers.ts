// ============================================================================
// Canonical HTTP Header Names
// ============================================================================

export const HeaderNames = {
  X_API_KEY: 'x-api-key',
  IDEMPOTENCY_KEY: 'idempotency-key',
  X_IDEMPOTENT_REPLAY: 'X-Idempotent-Replay',
  X_RATELIMIT_LIMIT: 'X-RateLimit-Limit',
  X_RATELIMIT_REMAINING: 'X-RateLimit-Remaining',
  X_RATELIMIT_RESET: 'X-RateLimit-Reset',
  CF_CONNECTING_IP: 'cf-connecting-ip',
  X_FORWARDED_FOR: 'x-forwarded-for',
  X_FORWARDED_HOST: 'x-forwarded-host',
  CF_IPCOUNTRY: 'cf-ipcountry',
  USER_AGENT: 'user-agent',
  REFERER: 'referer',
  CONTENT_TYPE: 'content-type',
} as const;

export const HTTP_HEADERS = HeaderNames;

export const FALLBACK_IP = '127.0.0.1';
export const UNKNOWN_IP = 'UNKNOWN';
