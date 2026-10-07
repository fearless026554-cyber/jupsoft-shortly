-- ============================================================================
-- Jupsoft Shortly - Super Admin Provisioning Script
-- ============================================================================
-- Creates or updates root Super Admin Sachin Sharma (sachin@jupsoft.com)
-- and provisions the primary system domain (go.jupsoft.com).
-- Uses pgcrypto for native bcrypt password hashing.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
    v_domain_id UUID := '0bb05033-f0ae-4779-b747-d386b8d67be1';
    v_admin_id  UUID := '4a0e8559-e3f9-496f-bca2-6ef990744fe6';
    v_admin_email TEXT := COALESCE(NULLIF(current_setting('app.admin_email', true), ''), 'sachin@jupsoft.com');
    v_admin_pass  TEXT := COALESCE(NULLIF(current_setting('app.admin_password', true), ''), 'Admin@Jupsoft2026!');
    v_domain_host TEXT := COALESCE(NULLIF(current_setting('app.domain_host', true), ''), 'go.jupsoft.com');
BEGIN
    -- 1. Ensure root tenant exists
    INSERT INTO tenants (id, code, name, status, plan_id)
    VALUES (v_tenant_id, 'jupsoft', 'Jupsoft Technologies', 'active', 'internal_unlimited')
    ON CONFLICT (code) DO NOTHING;

    -- 2. Ensure default domain exists (go.jupsoft.com)
    INSERT INTO domains (id, tenant_id, hostname, type, verification_status, ssl_active)
    VALUES (v_domain_id, v_tenant_id, v_domain_host, 'internal', 'verified', true)
    ON CONFLICT (hostname) DO UPDATE
    SET hostname = v_domain_host, verification_status = 'verified', ssl_active = true, updated_at = NOW();

    -- 3. Provision or reset Super Administrator (Sachin Sharma)
    INSERT INTO users (id, tenant_id, name, email, password_hash, role, status)
    VALUES (
        v_admin_id,
        v_tenant_id,
        'Sachin Sharma',
        v_admin_email,
        crypt(v_admin_pass, gen_salt('bf', 10)),
        'super_admin',
        'active'
    )
    ON CONFLICT (email) DO UPDATE
    SET name = 'Sachin Sharma',
        password_hash = crypt(v_admin_pass, gen_salt('bf', 10)),
        status = 'active',
        role = 'super_admin',
        updated_at = NOW();

    RAISE NOTICE 'Super Administrator account ready: % (Sachin Sharma) on domain: %', v_admin_email, v_domain_host;
END $$;
