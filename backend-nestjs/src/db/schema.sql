-- ============================================================================
-- JLMP Database Schema (PostgreSQL 16)
-- Complete DDL with Row-Level Security (RLS) & Partitioning (Bug Fixes Applied)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'user', 'read_only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'invited', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE domain_type AS ENUM ('internal', 'public', 'subdomain', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE domain_verification_status AS ENUM ('pending', 'verified', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dlt_whitelisting_status AS ENUM ('pending', 'submitted', 'whitelisted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE redirect_type AS ENUM ('302', '307');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE link_status AS ENUM ('active', 'disabled', 'expired', 'archived', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status tenant_status NOT NULL DEFAULT 'active',
    plan_id VARCHAR(64) DEFAULT 'internal_unlimited',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. Domains Table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    hostname VARCHAR(255) NOT NULL UNIQUE,
    type domain_type NOT NULL DEFAULT 'custom',
    verification_status domain_verification_status NOT NULL DEFAULT 'pending',
    dlt_status dlt_whitelisting_status NOT NULL DEFAULT 'pending',
    dlt_registration_details JSONB DEFAULT '{}'::jsonb,
    ssl_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_domains_hostname ON domains(hostname);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    google_id VARCHAR(255),
    avatar_url TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- 4. Links Table
CREATE TABLE IF NOT EXISTS links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id),
    short_code VARCHAR(64) NOT NULL,
    alias VARCHAR(128),
    destination_url TEXT NOT NULL,
    redirect_type redirect_type NOT NULL DEFAULT '302',
    status link_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    max_clicks BIGINT,
    click_count BIGINT NOT NULL DEFAULT 0,
    tag VARCHAR(64),
    external_ref VARCHAR(128),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_domain_short_code UNIQUE(domain_id, short_code),
    CONSTRAINT uq_tenant_alias UNIQUE(tenant_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_links_lookup ON links(domain_id, short_code);
CREATE INDEX IF NOT EXISTS idx_links_tenant_alias ON links(tenant_id, alias);
CREATE INDEX IF NOT EXISTS idx_links_external_ref ON links(tenant_id, external_ref);

-- 5. QR Codes Table
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL UNIQUE REFERENCES links(id) ON DELETE CASCADE,
    is_dynamic BOOLEAN NOT NULL DEFAULT TRUE,
    foreground_color VARCHAR(16) NOT NULL DEFAULT '#000000',
    background_color VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
    qr_svg_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Clicks Table (Partitioned by Month + DEFAULT PARTITION TO PREVENT CRASHES)
CREATE TABLE IF NOT EXISTS clicks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    clicked_at TIMESTAMPTZ NOT NULL,
    visitor_hash VARCHAR(64) NOT NULL,
    device VARCHAR(32),
    browser VARCHAR(64),
    os VARCHAR(64),
    country VARCHAR(8),
    referrer TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);

-- Catch-all Default Partition (Fix 4: Prevents DB Crash on Unmapped Month Ranges)
CREATE TABLE IF NOT EXISTS clicks_default PARTITION OF clicks DEFAULT;

CREATE INDEX IF NOT EXISTS idx_clicks_link_time ON clicks (link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_tenant_time ON clicks (tenant_id, clicked_at DESC);

-- 7. Click Daily Aggregates (Fast Dashboard Rollups)
CREATE TABLE IF NOT EXISTS click_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clicks BIGINT NOT NULL DEFAULT 0,
    unique_clicks BIGINT NOT NULL DEFAULT 0,
    bot_clicks BIGINT NOT NULL DEFAULT 0,
    by_device JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_os JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_browser JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_country JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_referrer JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_link_date UNIQUE(link_id, date)
);
CREATE INDEX IF NOT EXISTS idx_click_daily_tenant_date ON click_daily(tenant_id, date DESC);

-- 8. Outcomes Attribution (FR-16 - Append-Only Ledger with Optional event_id Idempotency)
CREATE TABLE IF NOT EXISTS outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    link_id UUID REFERENCES links(id) ON DELETE SET NULL,
    external_ref VARCHAR(128) NOT NULL,
    outcome_type VARCHAR(64) NOT NULL,
    value NUMERIC(12, 2) DEFAULT 0.00,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_id VARCHAR(128),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE click_daily ADD COLUMN IF NOT EXISTS bot_clicks BIGINT NOT NULL DEFAULT 0;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS event_id VARCHAR(128);
ALTER TABLE outcomes DROP CONSTRAINT IF EXISTS uq_tenant_external_ref_outcome;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_outcomes_tenant_event_id') THEN
        ALTER TABLE outcomes ADD CONSTRAINT uq_outcomes_tenant_event_id UNIQUE (tenant_id, event_id);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_outcomes_link_id ON outcomes(link_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_tenant_ref ON outcomes(tenant_id, external_ref);

-- 9. API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{"links:read", "links:write", "analytics:read", "outcomes:write"}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(key_prefix, revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- 10. Abuse Reports Table
CREATE TABLE IF NOT EXISTS abuse_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    reporter_email VARCHAR(255),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_abuse_status ON abuse_reports(status);

-- 11. Screening Results Table (FR-08)
CREATE TABLE IF NOT EXISTS screening_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    verdict VARCHAR(32) NOT NULL,
    raw_response JSONB,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_screening_link ON screening_results(link_id);

-- 12. Audit Log Table (Security & Compliance)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_type VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);

-- ============================================================================
-- 0. Helper Functions (SECURITY DEFINER to avoid recursive policy checks)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_link_exists(p_link_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.links WHERE id = p_link_id);
$$;

CREATE OR REPLACE FUNCTION public.check_link_tenant_access(p_link_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.links
    WHERE id = p_link_id
      AND (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_link_exists(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_link_tenant_access(uuid) TO PUBLIC;

-- ============================================================================
-- Row-Level Security (RLS) Policies (DB-Enforced via FORCE RLS - PRD Compliant)
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_select_tenants ON tenants;
DROP POLICY IF EXISTS tenant_insert_tenants ON tenants;
DROP POLICY IF EXISTS tenant_update_tenants ON tenants;
DROP POLICY IF EXISTS tenant_delete_tenants ON tenants;
CREATE POLICY tenant_select_tenants ON tenants FOR SELECT USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY tenant_insert_tenants ON tenants FOR INSERT WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY tenant_update_tenants ON tenants FOR UPDATE USING (current_setting('app.is_super_admin', true) = 'true') WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY tenant_delete_tenants ON tenants FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_domains ON domains;
DROP POLICY IF EXISTS domain_select_policy ON domains;
DROP POLICY IF EXISTS domain_insert_policy ON domains;
DROP POLICY IF EXISTS domain_update_policy ON domains;
DROP POLICY IF EXISTS domain_delete_policy ON domains;
CREATE POLICY domain_select_policy ON domains FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR tenant_id IS NULL OR type IN ('internal', 'public') OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY domain_insert_policy ON domains FOR INSERT WITH CHECK ((tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY domain_update_policy ON domains FOR UPDATE USING ((tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK ((tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY domain_delete_policy ON domains FOR DELETE USING ((tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_users ON users;
DROP POLICY IF EXISTS user_select_policy ON users;
DROP POLICY IF EXISTS user_insert_policy ON users;
DROP POLICY IF EXISTS user_update_policy ON users;
DROP POLICY IF EXISTS user_delete_policy ON users;
CREATE POLICY user_select_policy ON users FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY user_insert_policy ON users FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY user_update_policy ON users FOR UPDATE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY user_delete_policy ON users FOR DELETE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_links ON links;
DROP POLICY IF EXISTS link_select_policy ON links;
DROP POLICY IF EXISTS link_insert_policy ON links;
DROP POLICY IF EXISTS link_update_policy ON links;
DROP POLICY IF EXISTS link_delete_policy ON links;
CREATE POLICY link_select_policy ON links FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY link_insert_policy ON links FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY link_update_policy ON links FOR UPDATE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY link_delete_policy ON links FOR DELETE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_qr_codes ON qr_codes;
DROP POLICY IF EXISTS qr_select_policy ON qr_codes;
DROP POLICY IF EXISTS qr_insert_policy ON qr_codes;
DROP POLICY IF EXISTS qr_update_policy ON qr_codes;
DROP POLICY IF EXISTS qr_delete_policy ON qr_codes;
CREATE POLICY qr_select_policy ON qr_codes FOR SELECT USING (public.check_link_tenant_access(link_id));
CREATE POLICY qr_insert_policy ON qr_codes FOR INSERT WITH CHECK (public.check_link_tenant_access(link_id));
CREATE POLICY qr_update_policy ON qr_codes FOR UPDATE USING (public.check_link_tenant_access(link_id)) WITH CHECK (public.check_link_tenant_access(link_id));
CREATE POLICY qr_delete_policy ON qr_codes FOR DELETE USING (public.check_link_tenant_access(link_id));

ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_screening_results ON screening_results;
DROP POLICY IF EXISTS screening_select_policy ON screening_results;
DROP POLICY IF EXISTS screening_insert_policy ON screening_results;
DROP POLICY IF EXISTS screening_update_policy ON screening_results;
DROP POLICY IF EXISTS screening_delete_policy ON screening_results;
CREATE POLICY screening_select_policy ON screening_results FOR SELECT USING (public.check_link_tenant_access(link_id));
CREATE POLICY screening_insert_policy ON screening_results FOR INSERT WITH CHECK (public.check_link_tenant_access(link_id));
CREATE POLICY screening_update_policy ON screening_results FOR UPDATE USING (public.check_link_tenant_access(link_id)) WITH CHECK (public.check_link_tenant_access(link_id));
CREATE POLICY screening_delete_policy ON screening_results FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_abuse_reports ON abuse_reports;
DROP POLICY IF EXISTS abuse_select_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_insert_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_update_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_delete_policy ON abuse_reports;
CREATE POLICY abuse_select_policy ON abuse_reports FOR SELECT USING (public.check_link_tenant_access(link_id) OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY abuse_insert_policy ON abuse_reports FOR INSERT WITH CHECK (public.check_link_exists(link_id));
CREATE POLICY abuse_update_policy ON abuse_reports FOR UPDATE USING (public.check_link_tenant_access(link_id) OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK (public.check_link_tenant_access(link_id) OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY abuse_delete_policy ON abuse_reports FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_clicks ON clicks;
DROP POLICY IF EXISTS click_select_policy ON clicks;
DROP POLICY IF EXISTS click_insert_policy ON clicks;
DROP POLICY IF EXISTS click_update_policy ON clicks;
DROP POLICY IF EXISTS click_delete_policy ON clicks;
CREATE POLICY click_select_policy ON clicks FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_insert_policy ON clicks FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_update_policy ON clicks FOR UPDATE USING (current_setting('app.is_super_admin', true) = 'true') WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_delete_policy ON clicks FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE click_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_daily FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_click_daily ON click_daily;
DROP POLICY IF EXISTS click_daily_select_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_insert_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_update_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_delete_policy ON click_daily;
CREATE POLICY click_daily_select_policy ON click_daily FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_daily_insert_policy ON click_daily FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_daily_update_policy ON click_daily FOR UPDATE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY click_daily_delete_policy ON click_daily FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_outcomes ON outcomes;
DROP POLICY IF EXISTS outcome_select_policy ON outcomes;
DROP POLICY IF EXISTS outcome_insert_policy ON outcomes;
DROP POLICY IF EXISTS outcome_update_policy ON outcomes;
DROP POLICY IF EXISTS outcome_delete_policy ON outcomes;
CREATE POLICY outcome_select_policy ON outcomes FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY outcome_insert_policy ON outcomes FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY outcome_update_policy ON outcomes FOR UPDATE USING (current_setting('app.is_super_admin', true) = 'true') WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY outcome_delete_policy ON outcomes FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
DROP POLICY IF EXISTS api_key_select_policy ON api_keys;
DROP POLICY IF EXISTS api_key_insert_policy ON api_keys;
DROP POLICY IF EXISTS api_key_update_policy ON api_keys;
DROP POLICY IF EXISTS api_key_delete_policy ON api_keys;
CREATE POLICY api_key_select_policy ON api_keys FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY api_key_insert_policy ON api_keys FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY api_key_update_policy ON api_keys FOR UPDATE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true') WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY api_key_delete_policy ON api_keys FOR DELETE USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_log ON audit_log;
DROP POLICY IF EXISTS audit_select_policy ON audit_log;
DROP POLICY IF EXISTS audit_insert_policy ON audit_log;
DROP POLICY IF EXISTS audit_update_policy ON audit_log;
DROP POLICY IF EXISTS audit_delete_policy ON audit_log;
CREATE POLICY audit_select_policy ON audit_log FOR SELECT USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY audit_insert_policy ON audit_log FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY audit_update_policy ON audit_log FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY audit_delete_policy ON audit_log FOR DELETE USING (false);


