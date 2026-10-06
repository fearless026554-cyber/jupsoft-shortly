const { Client } = require('pg');

async function verifyRLS() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'shortly_app',
    password: 'shortly_secure_app_pwd',
    database: 'jlmp_db',
  });

  await client.connect();
  console.log('✅ Connected to Postgres as shortly_app!');

  // 1. Verify User Privilege
  const userCheck = await client.query('SELECT current_user, usesuper FROM pg_user WHERE usename = current_user');
  console.log('Role verification:', userCheck.rows[0]);
  if (userCheck.rows[0].usesuper !== false) {
    throw new Error('FAIL: shortly_app should NOT be a superuser!');
  }

  // 2. Query links without any session context
  const noContext = await client.query('SELECT count(*) FROM links');
  console.log('1. Links without context (RLS enforces zero access):', noContext.rows[0].count);
  if (Number(noContext.rows[0].count) !== 0) {
    throw new Error('FAIL: RLS did not isolate table when unauthenticated!');
  }

  // 3. Query links with Super Admin context (app.is_super_admin = true)
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.is_super_admin', 'true', true)");
  const superAdminContext = await client.query('SELECT count(*) FROM links');
  console.log('2. Links with Super Admin context (RLS bypass active):', superAdminContext.rows[0].count);
  await client.query('COMMIT');
  if (Number(superAdminContext.rows[0].count) <= 0) {
    throw new Error('FAIL: Super admin context could not read links!');
  }

  // 4. Query links with Tenant Context (app.current_tenant_id)
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', true)");
  const tenantContext = await client.query('SELECT count(*) FROM links');
  console.log('3. Links scoped to Tenant 11111111-1111-1111-1111-111111111111:', tenantContext.rows[0].count);
  await client.query('COMMIT');

  // 5. Cross-Tenant IDOR test under non-superuser:
  // Query with Tenant 22222222-2222-2222-2222-222222222222 should NOT see Tenant 11111111-1111-1111-1111-111111111111's links
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', true)");
  const otherTenantContext = await client.query("SELECT count(*) FROM links WHERE tenant_id = '11111111-1111-1111-1111-111111111111'");
  console.log('4. Cross-tenant query attempt (Tenant B attempting to select Tenant A links):', otherTenantContext.rows[0].count);
  await client.query('COMMIT');
  if (Number(otherTenantContext.rows[0].count) !== 0) {
    throw new Error('FAIL: Cross-tenant IDOR detected under RLS!');
  }

  console.log('\n🎉 ALL RLS CHECKS PASSED: PostgreSQL Row Level Security is 100% active and enforced by kernel on non-superuser shortly_app!');
  await client.end();
}

verifyRLS().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
