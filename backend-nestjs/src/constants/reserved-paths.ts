// ============================================================================
// Single Canonical Reserved Paths List (Prevents Route Shadowing & Collisions)
// ============================================================================

export const RESERVED_PATHS: ReadonlySet<string> = new Set([
  'api',
  'admin',
  'console',
  'login',
  'logout',
  'health',
  'metrics',
  'static',
  'assets',
  'qr',
  'report',
  'webhook',
  'billing',
  'system',
  'favicon.ico',
  'robots.txt',
  'docs',
  'status',
  'r',
]);

export function isReservedPath(pathSegment: string): boolean {
  return RESERVED_PATHS.has(pathSegment.trim().toLowerCase());
}
