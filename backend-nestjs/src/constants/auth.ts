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

export const COMMON_PASSWORDS_BLOCKLIST = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'admin123',
  'qwerty123',
  'welcome1',
  'letmein1',
  'changeme',
  'iloveyou',
  'sunshine1',
  'monkey123',
  'football',
]);

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password cannot exceed 128 characters.' };
  }
  if (COMMON_PASSWORDS_BLOCKLIST.has(password.toLowerCase().trim())) {
    return {
      valid: false,
      message: 'This password is too common and easily guessed. Please choose a stronger password.',
    };
  }
  return { valid: true };
}
