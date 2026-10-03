// ============================================================================
// Canonical Application Error Codes
// ============================================================================

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  KEY_REVOKED: 'KEY_REVOKED',
  KEY_EXPIRED: 'KEY_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DOMAIN_CONFLICT: 'DOMAIN_CONFLICT',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT',
  SCREENING_FAILED: 'SCREENING_FAILED',
  ALIAS_CONFLICT: 'ALIAS_CONFLICT',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
