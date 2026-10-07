const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-0-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'shortly_app.iqkqczxbtqoxcnmadegn',
  password: 'Jupsoft_Shortly_2026_App_Role!',
  ssl: { rejectUnauthorized: false }
});

async function runTests() {
  const client = await pool.connect();
  console.log('Connected to Supabase PostgreSQL as shortly_app!');
  
  try {
    // 1. Fetch a real tenant and domain using Super Admin context inside transaction
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_super_admin', 'true', true)");
    const tenantRes = await client.query('SELECT id, code FROM tenants LIMIT 1');
    const tenantId = tenantRes.rows[0].id;
    console.log('Test Tenant:', tenantRes.rows[0]);

    const domainRes = await client.query('SELECT id, hostname FROM domains LIMIT 1');
    const domainId = domainRes.rows[0].id;
    console.log('Test Domain:', domainRes.rows[0]);
    await client.query('COMMIT');

    // Test A: Tenant context link creation + QR + screening
    console.log('\n--- Test A: withTenantContext Link Creation ---');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
    
    const testCode = 'rls' + Math.floor(Math.random() * 89999 + 10000);
    const linkRes = await client.query(
      `INSERT INTO links (tenant_id, domain_id, short_code, destination_url, redirect_type, status)
       VALUES ($1, $2, $3, 'https://jupsoft.com/rls-test', '302', 'active')
       RETURNING id, short_code`,
      [tenantId, domainId, testCode]
    );
    const linkId = linkRes.rows[0].id;
    console.log('Link inserted successfully:', linkRes.rows[0]);

    // Insert QR code for link
    await client.query(
      `INSERT INTO qr_codes (link_id, is_dynamic, qr_svg_data) VALUES ($1, true, '<svg></svg>')`,
      [linkId]
    );
    console.log('QR Code inserted successfully!');

    // Insert Screening Result
    await client.query(
      `INSERT INTO screening_results (link_id, provider, verdict) VALUES ($1, 'heuristics', 'pending')`,
      [linkId]
    );
    console.log('Screening Result inserted successfully!');

    // Commit Test A
    await client.query('COMMIT');

    // Test B: Public abuse report submission (as processed by backend withSuperAdminContext)
    console.log('\n--- Test B: Public Abuse Report Submission via Backend Ingestion ---');
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_super_admin', 'true', true)");

    const abuseRes = await client.query(
      `INSERT INTO abuse_reports (link_id, reason, reporter_email, status)
       VALUES ($1, 'Public user reported this link', 'parent@school.com', 'pending')
       RETURNING id, status`,
      [linkId]
    );
    console.log('Public Abuse Report inserted successfully:', abuseRes.rows[0]);
    await client.query('COMMIT');

    // Test B2: Direct unauthenticated SQL insert (without RETURNING)
    console.log('\n--- Test B2: Direct SQL Insert without session context ---');
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', '', true)");
    await client.query("SELECT set_config('app.is_super_admin', '', true)");
    await client.query(
      `INSERT INTO abuse_reports (link_id, reason, reporter_email, status)
       VALUES ($1, 'Direct anonymous report', 'anonymous@public.com', 'pending')`,
      [linkId]
    );
    console.log('Direct anonymous SQL INSERT without RETURNING succeeded!');
    await client.query('COMMIT');

    // Test C: Cross-tenant isolation verification
    console.log('\n--- Test C: Cross-Tenant Isolation Verification ---');
    const fakeTenantId = '00000000-0000-0000-0000-000000000001';
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', '${fakeTenantId}', true)`);
    await client.query(`SELECT set_config('app.is_super_admin', '', true)`);

    const foreignLinks = await client.query('SELECT id FROM links WHERE id = $1', [linkId]);
    console.log('Foreign tenant links visible:', foreignLinks.rowCount, '(Expected: 0)');
    if (foreignLinks.rowCount !== 0) {
      throw new Error('Tenant isolation violated: Foreign tenant could see link!');
    }

    let crossTenantWriteFailed = false;
    try {
      await client.query(
        `INSERT INTO links (tenant_id, domain_id, short_code, destination_url, redirect_type, status)
         VALUES ($1, $2, 'hack', 'https://bad.com', '302', 'active')`,
        [tenantId, domainId] // Trying to insert with another tenant's ID
      );
    } catch (err) {
      crossTenantWriteFailed = true;
      console.log('Cross-tenant write correctly BLOCKED:', err.message);
    }
    if (!crossTenantWriteFailed) {
      throw new Error('Cross-tenant write was not blocked!');
    }
    await client.query('ROLLBACK');

    // Test D: Super Admin visibility verification
    console.log('\n--- Test D: Super Admin Visibility Verification ---');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    const superAdminLinks = await client.query('SELECT id FROM links WHERE id = $1', [linkId]);
    console.log('Super Admin links visible:', superAdminLinks.rowCount, '(Expected: 1)');
    if (superAdminLinks.rowCount !== 1) {
      throw new Error('Super admin could not view link across tenants!');
    }
    await client.query('COMMIT');

    // Test E: Audit Log Immutability
    console.log('\n--- Test E: Audit Log Immutability Verification ---');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
    const auditRes = await client.query(
      `INSERT INTO audit_log (tenant_id, actor_type, action, entity, entity_id)
       VALUES ($1, 'user', 'test.action', 'links', $2) RETURNING id`,
      [tenantId, linkId]
    );
    const auditId = auditRes.rows[0].id;
    console.log('Audit log inserted:', auditId);

    const updateRes = await client.query("UPDATE audit_log SET action = 'tampered' WHERE id = $1", [auditId]);
    if (updateRes.rowCount !== 0) {
      throw new Error(`Audit log UPDATE modified ${updateRes.rowCount} rows! Immutability violated.`);
    }
    console.log('Audit log UPDATE affected 0 rows (strictly immutable)!');

    const deleteRes = await client.query("DELETE FROM audit_log WHERE id = $1", [auditId]);
    if (deleteRes.rowCount !== 0) {
      throw new Error(`Audit log DELETE deleted ${deleteRes.rowCount} rows! Immutability violated.`);
    }
    console.log('Audit log DELETE affected 0 rows (strictly immutable)!');
    await client.query('ROLLBACK');

    console.log('\n======================================================');
    console.log('ALL PRD RLS VERIFICATION TESTS PASSED PERFECTLY (5/5)!');
    console.log('======================================================');

  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
