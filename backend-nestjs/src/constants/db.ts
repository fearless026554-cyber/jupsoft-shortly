// ============================================================================
// Canonical Database Session Keys & Table Names
// ============================================================================

export const DB_CONTEXT_KEYS = {
  TENANT_ID: 'app.current_tenant_id',
  IS_SUPER_ADMIN: 'app.is_super_admin',
} as const;

export const DB_TABLES = {
  TENANTS: 'tenants',
  USERS: 'users',
  DOMAINS: 'domains',
  LINKS: 'links',
  QR_CODES: 'qr_codes',
  CLICKS: 'clicks',
  CLICK_DAILY: 'click_daily',
  OUTCOMES: 'outcomes',
  API_KEYS: 'api_keys',
  SCREENING_RESULTS: 'screening_results',
  ABUSE_REPORTS: 'abuse_reports',
  AUDIT_LOG: 'audit_log',
} as const;
