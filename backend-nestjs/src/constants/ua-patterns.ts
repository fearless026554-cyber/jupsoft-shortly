// ============================================================================
// Canonical User-Agent Parsing Patterns & Date Constants
// ============================================================================

export const UA_PATTERNS = {
  BOTS: /bot|crawler|spider|crawling|slurp|whatsapp|facebookexternalhit|twitterbot|telegrambot|curl|wget|python-requests/i,
  IOS: /iphone|ipad|ipod/i,
  ANDROID: /android/i,
  WINDOWS: /windows/i,
  MACOS: /macintosh|mac os/i,
  LINUX: /linux/i,
  TABLET: /ipad|tablet/i,
  MOBILE: /mobile|android|iphone/i,
  EDGE: /edg\//i,
  CHROME: /chrome\//i,
  SAFARI: /safari\//i,
  FIREFOX: /firefox\//i,
} as const;

export const DATE_CONSTANTS = {
  ISO_DATE_PREFIX_LEN: 10, // 'YYYY-MM-DD'
} as const;
