-- ============================================================================
-- Production Principle of Least Privilege: Non-Superuser Application Role
-- ============================================================================
-- Run this script as the PostgreSQL cluster administrator (postgres)
-- to provision or update the dedicated application role for Jupsoft Shortly.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'shortly_app') THEN
        CREATE ROLE shortly_app WITH LOGIN PASSWORD 'shortly_secure_app_pwd' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
        RAISE NOTICE 'Role shortly_app created successfully.';
    ELSE
        ALTER ROLE shortly_app WITH PASSWORD 'shortly_secure_app_pwd' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        RAISE NOTICE 'Role shortly_app updated with least-privilege constraints.';
    END IF;
END $$;

-- 1. Database Connection & Schema Access
GRANT CONNECT ON DATABASE jlmp_db TO shortly_app;
GRANT USAGE ON SCHEMA public TO shortly_app;

-- 2. CRUD Privileges on Application Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shortly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shortly_app;

-- 3. Default Privileges for Future Partitions & Tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shortly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO shortly_app;

-- Confirm RLS Enforcement: Verify shortly_app is NOT a superuser and does NOT bypass RLS
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'shortly_app';
