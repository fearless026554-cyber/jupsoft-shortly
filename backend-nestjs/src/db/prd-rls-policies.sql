-- ============================================================================
-- Jupsoft Link Management Platform (JLMP) - Comprehensive PRD RLS Policies
-- Aligned with PRD v1.0 & TRD v1.0 specifications
-- Author: Antigravity Agent
-- Date: 2026-10-07
-- ============================================================================

-- 0. Helper Functions (SECURITY DEFINER to avoid recursive policy checks)
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
-- 1. TENANTS TABLE (PRD FR-01)
-- Super Admin manages tenants; Tenants have read-only access to their own record
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_select_tenants ON tenants;
DROP POLICY IF EXISTS tenant_insert_tenants ON tenants;
DROP POLICY IF EXISTS tenant_update_tenants ON tenants;
DROP POLICY IF EXISTS tenant_delete_tenants ON tenants;

CREATE POLICY tenant_select_tenants ON tenants
    FOR SELECT
    USING (
        id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY tenant_insert_tenants ON tenants
    FOR INSERT
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY tenant_update_tenants ON tenants
    FOR UPDATE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY tenant_delete_tenants ON tenants
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 2. DOMAINS TABLE (PRD FR-18, Page 7)
-- System domains (internal/public) shared with all; Custom domains tenant-isolated
-- ============================================================================
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_domains ON domains;
DROP POLICY IF EXISTS domain_select_policy ON domains;
DROP POLICY IF EXISTS domain_insert_policy ON domains;
DROP POLICY IF EXISTS domain_update_policy ON domains;
DROP POLICY IF EXISTS domain_delete_policy ON domains;

CREATE POLICY domain_select_policy ON domains
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR tenant_id IS NULL
        OR type IN ('internal', 'public')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY domain_insert_policy ON domains
    FOR INSERT
    WITH CHECK (
        (tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY domain_update_policy ON domains
    FOR UPDATE
    USING (
        (tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        (tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY domain_delete_policy ON domains
    FOR DELETE
    USING (
        (tenant_id IS NOT NULL AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 3. USERS TABLE (PRD FR-02)
-- Users isolated by tenant; Super Admin has global management
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_users ON users;
DROP POLICY IF EXISTS user_select_policy ON users;
DROP POLICY IF EXISTS user_insert_policy ON users;
DROP POLICY IF EXISTS user_update_policy ON users;
DROP POLICY IF EXISTS user_delete_policy ON users;

CREATE POLICY user_select_policy ON users
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY user_insert_policy ON users
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY user_update_policy ON users
    FOR UPDATE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY user_delete_policy ON users
    FOR DELETE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 4. LINKS TABLE (PRD FR-03, FR-04, FR-05, FR-07)
-- Links strictly tenant-isolated; Super Admin has cross-tenant access
-- ============================================================================
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_links ON links;
DROP POLICY IF EXISTS link_select_policy ON links;
DROP POLICY IF EXISTS link_insert_policy ON links;
DROP POLICY IF EXISTS link_update_policy ON links;
DROP POLICY IF EXISTS link_delete_policy ON links;

CREATE POLICY link_select_policy ON links
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY link_insert_policy ON links
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY link_update_policy ON links
    FOR UPDATE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY link_delete_policy ON links
    FOR DELETE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 5. QR CODES TABLE (PRD FR-10)
-- Linked to links.id; Accessible by tenant owning the link or Super Admin
-- ============================================================================
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_qr_codes ON qr_codes;
DROP POLICY IF EXISTS qr_select_policy ON qr_codes;
DROP POLICY IF EXISTS qr_insert_policy ON qr_codes;
DROP POLICY IF EXISTS qr_update_policy ON qr_codes;
DROP POLICY IF EXISTS qr_delete_policy ON qr_codes;

CREATE POLICY qr_select_policy ON qr_codes
    FOR SELECT
    USING (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY qr_insert_policy ON qr_codes
    FOR INSERT
    WITH CHECK (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY qr_update_policy ON qr_codes
    FOR UPDATE
    USING (
        public.check_link_tenant_access(link_id)
    )
    WITH CHECK (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY qr_delete_policy ON qr_codes
    FOR DELETE
    USING (
        public.check_link_tenant_access(link_id)
    );

-- ============================================================================
-- 6. SCREENING RESULTS TABLE (PRD FR-08)
-- Linked to links.id; Read/insert by tenant owning link; Delete restricted to Super Admin
-- ============================================================================
ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_screening_results ON screening_results;
DROP POLICY IF EXISTS screening_select_policy ON screening_results;
DROP POLICY IF EXISTS screening_insert_policy ON screening_results;
DROP POLICY IF EXISTS screening_update_policy ON screening_results;
DROP POLICY IF EXISTS screening_delete_policy ON screening_results;

CREATE POLICY screening_select_policy ON screening_results
    FOR SELECT
    USING (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY screening_insert_policy ON screening_results
    FOR INSERT
    WITH CHECK (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY screening_update_policy ON screening_results
    FOR UPDATE
    USING (
        public.check_link_tenant_access(link_id)
    )
    WITH CHECK (
        public.check_link_tenant_access(link_id)
    );

CREATE POLICY screening_delete_policy ON screening_results
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 7. ABUSE REPORTS TABLE (PRD FR-09)
-- Public unauthenticated insert allowed for valid links; Triage by tenant/super_admin
-- ============================================================================
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_abuse_reports ON abuse_reports;
DROP POLICY IF EXISTS abuse_select_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_insert_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_update_policy ON abuse_reports;
DROP POLICY IF EXISTS abuse_delete_policy ON abuse_reports;

CREATE POLICY abuse_select_policy ON abuse_reports
    FOR SELECT
    USING (
        public.check_link_tenant_access(link_id)
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY abuse_insert_policy ON abuse_reports
    FOR INSERT
    WITH CHECK (
        public.check_link_exists(link_id)
    );

CREATE POLICY abuse_update_policy ON abuse_reports
    FOR UPDATE
    USING (
        public.check_link_tenant_access(link_id)
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        public.check_link_tenant_access(link_id)
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY abuse_delete_policy ON abuse_reports
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 8. CLICKS TABLE (PRD FR-11)
-- Read tenant-isolated; Insert via worker/tenant; Mutation restricted
-- ============================================================================
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_clicks ON clicks;
DROP POLICY IF EXISTS click_select_policy ON clicks;
DROP POLICY IF EXISTS click_insert_policy ON clicks;
DROP POLICY IF EXISTS click_update_policy ON clicks;
DROP POLICY IF EXISTS click_delete_policy ON clicks;

CREATE POLICY click_select_policy ON clicks
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_insert_policy ON clicks
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_update_policy ON clicks
    FOR UPDATE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_delete_policy ON clicks
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 9. CLICK DAILY AGGREGATES TABLE (PRD FR-12)
-- Dashboard rollups tenant-isolated
-- ============================================================================
ALTER TABLE click_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_daily FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_click_daily ON click_daily;
DROP POLICY IF EXISTS click_daily_select_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_insert_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_update_policy ON click_daily;
DROP POLICY IF EXISTS click_daily_delete_policy ON click_daily;

CREATE POLICY click_daily_select_policy ON click_daily
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_daily_insert_policy ON click_daily
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_daily_update_policy ON click_daily
    FOR UPDATE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY click_daily_delete_policy ON click_daily
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 10. OUTCOMES ATTRIBUTION TABLE (PRD FR-16)
-- Enterprise attribution events; Append-only ledger; Tenant-isolated
-- ============================================================================
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_outcomes ON outcomes;
DROP POLICY IF EXISTS outcome_select_policy ON outcomes;
DROP POLICY IF EXISTS outcome_insert_policy ON outcomes;
DROP POLICY IF EXISTS outcome_update_policy ON outcomes;
DROP POLICY IF EXISTS outcome_delete_policy ON outcomes;

CREATE POLICY outcome_select_policy ON outcomes
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY outcome_insert_policy ON outcomes
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY outcome_update_policy ON outcomes
    FOR UPDATE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY outcome_delete_policy ON outcomes
    FOR DELETE
    USING (
        current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 11. API KEYS TABLE (PRD FR-14)
-- Tenant-isolated API key management
-- ============================================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
DROP POLICY IF EXISTS api_key_select_policy ON api_keys;
DROP POLICY IF EXISTS api_key_insert_policy ON api_keys;
DROP POLICY IF EXISTS api_key_update_policy ON api_keys;
DROP POLICY IF EXISTS api_key_delete_policy ON api_keys;

CREATE POLICY api_key_select_policy ON api_keys
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY api_key_insert_policy ON api_keys
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY api_key_update_policy ON api_keys
    FOR UPDATE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY api_key_delete_policy ON api_keys
    FOR DELETE
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- ============================================================================
-- 12. AUDIT LOG TABLE (PRD Page 11, 12)
-- Immutable audit log: Tenant-isolated reads/writes; Updates/deletes strictly blocked
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_log ON audit_log;
DROP POLICY IF EXISTS audit_select_policy ON audit_log;
DROP POLICY IF EXISTS audit_insert_policy ON audit_log;
DROP POLICY IF EXISTS audit_update_policy ON audit_log;
DROP POLICY IF EXISTS audit_delete_policy ON audit_log;

CREATE POLICY audit_select_policy ON audit_log
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY audit_insert_policy ON audit_log
    FOR INSERT
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY audit_update_policy ON audit_log
    FOR UPDATE
    USING (false)
    WITH CHECK (false);

CREATE POLICY audit_delete_policy ON audit_log
    FOR DELETE
    USING (false);
