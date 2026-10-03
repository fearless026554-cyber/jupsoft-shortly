// ============================================================================
// Canonical Anti-Abuse & Screening Configurations
// ============================================================================

export const DEFAULT_DISALLOWED_SHORTENERS: readonly string[] = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'rb.gy',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'shorturl.at',
] as const;

export const SAFE_BROWSING_CONFIG = {
  CLIENT_ID: 'jupsoft-jlmp',
  CLIENT_VERSION: '1.0.0',
  THREAT_TYPES: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
  PLATFORM_TYPES: ['ANY_PLATFORM'],
  THREAT_ENTRY_TYPES: ['URL'],
} as const;
