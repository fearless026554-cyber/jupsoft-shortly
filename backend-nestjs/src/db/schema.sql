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
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

-- 4. Links Table
CREATE TABLE IF NOT EXISTS links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id),
    short_code VARCHAR(16) NOT NULL,
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
-- Row-Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_links ON links;
    CREATE POLICY tenant_isolation_links ON links
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        );
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_click_daily ON click_daily;
    CREATE POLICY tenant_isolation_click_daily ON click_daily
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        );
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_outcomes ON outcomes;
    CREATE POLICY tenant_isolation_outcomes ON outcomes
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.is_super_admin', true) = 'true'
        );
END $$;

