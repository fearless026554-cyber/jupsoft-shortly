// ============================================================================
// Single Canonical Reserved Paths List (Prevents Route Shadowing & Collisions)
// ============================================================================

export const RESERVED_PATHS: ReadonlySet<string> = new Set([
  'api',
  'admin',
  'console',
  'dashboard',
  'overview',
  'links',
  'bulk',
  'outcomes',
  'qr',
  'reports',
  'analytics',
  'tenants',
  'users',
  'domains',
  'abuse',
  'apikeys',
  'profile',
  'help',
  'landing',
  'login',
  'logout',
  'health',
  'metrics',
  'static',
  'assets',
  'report',
  'webhook',
  'billing',
  'system',
  'favicon.ico',
  'favicon.png',
  'jupsoft-logo.png',
  'icon.png',
  'robots.txt',
  'docs',
  'status',
  'r',
]);

export function isReservedPath(pathSegment: string): boolean {
  return RESERVED_PATHS.has(pathSegment.trim().toLowerCase());
}
