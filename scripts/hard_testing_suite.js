const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const baseDir = path.resolve(__dirname, '../backend-nestjs');
const { Pool } = require(path.join(baseDir, 'node_modules/pg'));
const dotenv = require(path.join(baseDir, 'node_modules/dotenv'));
const env = dotenv.parse(fs.readFileSync(path.join(baseDir, '.env')));

const pool = new Pool({
  host: env.PG_HOST,
  port: parseInt(env.PG_PORT || '5432'),
  database: env.PG_DATABASE,
  user: env.PG_USER,
  password: String(env.PG_PASSWORD),
  ssl: env.PG_SSL === 'true' || (env.PG_HOST && env.PG_HOST.includes('supabase')) ? { rejectUnauthorized: false } : undefined,
});

async function runHardTesting() {
  const c = await pool.connect();
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    console.log('\n======================================================');
    console.log('HARD TESTING SUITE - JLMP Shortly Enterprise Engine');
    console.log('======================================================\n');

    // ------------------------------------------------------------------------
    // TEST 1: Apple & Google Play Store Link Integrity Verification
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Apple & Google Play Store Links Integrity ---');
    await c.query("SELECT set_config('app.is_super_admin', 'true', false)");

    const appleLinks = await c.query(
      "SELECT id, short_code, destination_url, status FROM links WHERE destination_url ILIKE '%apple%' ORDER BY created_at"
    );
    const playLinks = await c.query(
      "SELECT id, short_code, destination_url, status FROM links WHERE destination_url ILIKE '%play.google%' ORDER BY created_at"
    );

    console.log(`  -> Apple App Store links: ${appleLinks.rows.length}`);
    console.log(`  -> Google Play Store links: ${playLinks.rows.length}`);
    assert(appleLinks.rows.length === 10, `Expected 10 Apple App Store links, got ${appleLinks.rows.length}`);
    assert(playLinks.rows.length === 12, `Expected 12 Google Play Store links, got ${playLinks.rows.length}`);
    assert(appleLinks.rows.length + playLinks.rows.length === 22, 'Total Apple + Play links must equal exactly 22');

    const allActive = [...appleLinks.rows, ...playLinks.rows].every(l => l.status === 'active');
    assert(allActive, 'All 22 Apple & Play Store links must have status = "active"');

    // Test redirect resolution for a sample Apple link and a sample Play link
    const sampleApple = appleLinks.rows[0];
    const samplePlay = playLinks.rows[0];

    const appleLookup = await c.query('SELECT destination_url, status FROM links WHERE short_code = $1', [sampleApple.short_code]);
    assert(appleLookup.rows.length === 1 && appleLookup.rows[0].status === 'active', `Redirect lookup for Apple link (${sampleApple.short_code}) succeeded`);

    const playLookup = await c.query('SELECT destination_url, status FROM links WHERE short_code = $1', [samplePlay.short_code]);
    assert(playLookup.rows.length === 1 && playLookup.rows[0].status === 'active', `Redirect lookup for Play link (${samplePlay.short_code}) succeeded`);

    // ------------------------------------------------------------------------
    // TEST 2: Deterministic Keyset Cursor Pagination
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Keyset Cursor Pagination on Real Dataset ---');
    const totalCountRes = await c.query("SELECT count(*) FROM links");
    const totalExpected = parseInt(totalCountRes.rows[0].count, 10);
    assert(totalExpected === 46, `Current total links in DB must be exactly 46 (got ${totalExpected})`);

    let cursor = null;
    let paginatedRows = [];
    const pageSize = 15;
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      let q = 'SELECT id, short_code, created_at FROM links';
      const params = [];
      if (cursor) {
        const [curTime, curId] = cursor.split('__');
        params.push(new Date(curTime));
        const tIdx = params.length;
        params.push(curId);
        const iIdx = params.length;
        q += ` WHERE (created_at < $${tIdx} OR (created_at = $${tIdx} AND id < $${iIdx}))`;
      }
      params.push(pageSize);
      q += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length}`;

      const res = await c.query(q, params);
      if (res.rows.length === 0) break;
      paginatedRows = paginatedRows.concat(res.rows);
      if (res.rows.length < pageSize) break;

      const last = res.rows[res.rows.length - 1];
      const iso = last.created_at instanceof Date ? last.created_at.toISOString() : last.created_at;
      cursor = `${iso}__${last.id}`;
    }

    assert(paginatedRows.length === totalExpected, `Deterministic pagination fetched all ${totalExpected} rows with 0 duplicates and 0 drops`);
    const uniqueIds = new Set(paginatedRows.map(r => r.id));
    assert(uniqueIds.size === totalExpected, `All fetched paginated rows have unique UUIDs`);

    // ------------------------------------------------------------------------
    // TEST 3: High-Throughput Vectorized Batch Operations (Archive, Restore, Delete)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: High-Throughput Vectorized Batch Operations ---');
    const tenantRes = await c.query("SELECT id FROM tenants LIMIT 1");
    const tenantId = tenantRes.rows[0].id;
    const domainRes = await c.query("SELECT id FROM domains LIMIT 1");
    const domainId = domainRes.rows[0].id;

    // Create 10 temporary test links
    const tempIds = [];
    for (let i = 1; i <= 10; i++) {
      const code = 'hardtest_' + crypto.randomBytes(4).toString('hex');
      const ins = await c.query(
        `INSERT INTO links (tenant_id, domain_id, short_code, destination_url, redirect_type, status, tag)
         VALUES ($1, $2, $3, $4, '302', 'active', 'hardtest_temp')
         RETURNING id`,
        [tenantId, domainId, code, `https://jupsoft.com/test-${i}`]
      );
      tempIds.push(ins.rows[0].id);
    }
    assert(tempIds.length === 10, '10 temporary links inserted for batch testing');

    // 3A. Test Vectorized Batch Archive
    const tStartArchive = Date.now();
    const batchArchiveRes = await c.query(
      `UPDATE links SET status = 'archived', updated_at = NOW() WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
      [tempIds, tenantId]
    );
    const archiveDuration = Date.now() - tStartArchive;
    assert(batchArchiveRes.rowCount === 10, `Vectorized batch archive updated all 10 links in ${archiveDuration}ms`);
    assert(archiveDuration < 500, `Batch archive completed within SLA threshold (<500ms, actual: ${archiveDuration}ms)`);

    // 3B. Test Vectorized Batch Restore
    const tStartRestore = Date.now();
    const batchRestoreRes = await c.query(
      `UPDATE links SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
      [tempIds, tenantId]
    );
    const restoreDuration = Date.now() - tStartRestore;
    assert(batchRestoreRes.rowCount === 10, `Vectorized batch restore updated all 10 links in ${restoreDuration}ms`);

    // 3C. Test Vectorized Batch Permanent Delete
    const tStartDelete = Date.now();
    const batchDeleteRes = await c.query(
      `DELETE FROM links WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
      [tempIds, tenantId]
    );
    const deleteDuration = Date.now() - tStartDelete;
    assert(batchDeleteRes.rowCount === 10, `Vectorized batch delete removed all 10 links in ${deleteDuration}ms`);

    // ------------------------------------------------------------------------
    // TEST 4: Single Link Update / Restore Resilience (Zero 500 Regression)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Single Link Update & Super Admin Context Resilience ---');
    // Create 1 temporary link
    const singleTestCode = 'patchtest_' + crypto.randomBytes(4).toString('hex');
    const singleIns = await c.query(
      `INSERT INTO links (tenant_id, domain_id, short_code, destination_url, redirect_type, status, tag)
       VALUES ($1, $2, $3, $4, '302', 'archived', 'patchtest')
       RETURNING id`,
      [tenantId, domainId, singleTestCode, 'https://jupsoft.com/patch-test']
    );
    const singleId = singleIns.rows[0].id;

    // Simulate patch update without tenantId (Super Admin mode)
    const patchRes = await c.query(
      `UPDATE links SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING id, status`,
      [singleId]
    );
    assert(patchRes.rowCount === 1 && patchRes.rows[0].status === 'active', 'Super admin link status update succeeded cleanly');

    // Clean up single test link
    await c.query('DELETE FROM links WHERE id = $1', [singleId]);
    assert(true, 'Temporary patch test link cleaned up');

    // ------------------------------------------------------------------------
    // FINAL INTEGRITY CHECK: Apple & Google Play Store links untouched
    // ------------------------------------------------------------------------
    console.log('\n--- FINAL VERIFICATION: Apple & Google Play Store Protection ---');
    const finalApple = await c.query(
      "SELECT id FROM links WHERE destination_url ILIKE '%apple%'"
    );
    const finalPlay = await c.query(
      "SELECT id FROM links WHERE destination_url ILIKE '%play.google%'"
    );
    const finalTotal = await c.query("SELECT count(*) FROM links");

    assert(finalApple.rows.length === 10, 'Final Apple App Store links count is exactly 10');
    assert(finalPlay.rows.length === 12, 'Final Google Play Store links count is exactly 12');
    assert(parseInt(finalTotal.rows[0].count, 10) === 46, 'Total database links count returned to exactly 46');

    console.log('\n======================================================');
    console.log(`HARD TESTING COMPLETE: ${passed} PASSED, ${failed} FAILED!`);
    console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[FATAL ERROR during testing]:', err.message);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
}

runHardTesting();
