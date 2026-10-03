// ============================================================================
// Canonical Auth & Cryptography Constants
// ============================================================================

export const AUTH_CONSTANTS = {
  API_KEY_PREFIX: 'jlp_live_',
  API_KEY_RANDOM_BYTES: 24,
  API_KEY_PREFIX_LEN: 16,
  PASSWORD_RESET_BYTES: 16,
  HASH_ALGO: 'sha256',
  VISITOR_SALT_BYTES: 32,
} as const;

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
