-- ============================================================================
-- Migration: Add is_permanent column to links table in Supabase PostgreSQL
-- Run this in Supabase SQL Editor if you want the dedicated column.
-- Note: The backend application already supports permanent links natively!
-- ============================================================================

ALTER TABLE links ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE NOT NULL;
CREATE INDEX IF NOT EXISTS idx_links_is_permanent ON links (is_permanent);

-- Mark core 22 school mobile apps and permanent assets as permanent
UPDATE links
SET is_permanent = TRUE
WHERE external_ref = 'PERMANENT'
   OR external_ref LIKE 'PERMANENT:%'
   OR destination_url LIKE '%play.google.com%'
   OR destination_url LIKE '%apps.apple.com%'
   OR short_code IN (
     'pgsandrstd_app', 'pgsiosstd_app', 'admin_app_ios', 'admin_app_andrd',
     'ralliandrdstd_app', 'ralliiosstd_app', 'common_anrd_std_app', 'common_ios_std_app',
     'maxfortandrdstd_app', 'maxfortiosstd_app', 'qmsmtandrdstd_app', 'qmsmtiosstd_app',
     'lasiosstd_app', 'cityconventandrdstd_app', 'cityconventiosstd_app', 'lasandrdstd_app',
     'saiandrdstd_app', 'saiiosstd_app', 'vjpsandrdstd_app', 'cambridgemandiandrdstd_app',
     'cambridgemandiiosstd_app', 'visinstandrdstd_app'
   );
