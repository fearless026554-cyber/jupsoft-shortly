// ============================================================================
// Canonical HTML Template Service Configuration
// ============================================================================

export const TEMPLATE_CONFIG = {
  SRC_PATH: 'src/templates',
  DIST_PATH: 'dist/templates',
  ROOT_PATH: 'templates',
  FALLBACK_HTML: '<!DOCTYPE html><html><head><meta charset="utf-8"><title>{{title}}</title></head><body><h2>{{title}}</h2><p>{{message}}</p></body></html>',
} as const;
