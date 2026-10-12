const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Resolve PostgreSQL and dotenv from backend-nestjs
const baseDir = path.resolve(__dirname, '../backend-nestjs');
const { Pool } = require(path.join(baseDir, 'node_modules/pg'));
const dotenv = require(path.join(baseDir, 'node_modules/dotenv'));

const envPath = path.join(baseDir, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const pool = new Pool({
  host: envConfig.PG_HOST,
  port: parseInt(envConfig.PG_PORT || '5432'),
  database: envConfig.PG_DATABASE,
  user: envConfig.PG_USER,
  password: String(envConfig.PG_PASSWORD),
  ssl: envConfig.PG_SSL === 'true' || (envConfig.PG_HOST && envConfig.PG_HOST.includes('supabase'))
    ? { rejectUnauthorized: false }
    : undefined,
});

// Canonical Base58 Alphabet for collision-resistant short codes
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function generateShortCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

async function main() {
  const targetCount = parseInt(process.argv[2] || '500', 10);
  const targetTag = process.argv[3] || 'bulktest';

  console.log(`\n======================================================`);
  console.log(`JLMP Shortly - Bulk Link Generation Engine`);
  console.log(`Target Count: ${targetCount} links | Tag: #${targetTag}`);
  console.log(`======================================================\n`);

  const client = await pool.connect();
  const startTime = Date.now();

  try {
    // 1. Start transaction and set super admin context to access tenant & domain
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.is_super_admin', 'true', true)");
    
    const tenantRes = await client.query(
      "SELECT id, name, code FROM tenants LIMIT 1"
    );
    if (tenantRes.rows.length === 0) {
      throw new Error('Tenant not found. Please ensure initial migrations have run.');
    }
    const tenant = tenantRes.rows[0];

    const domainRes = await client.query(
      "SELECT id, hostname FROM domains LIMIT 1"
    );
    const domainId = domainRes.rows[0]?.id || '0bb05033-f0ae-4779-b747-d386b8d67be1';
    const domainHost = domainRes.rows[0]?.hostname || 'go.jupsoft.com';

    console.log(`[Config] Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`[Config] Domain: https://${domainHost} (${domainId})\n`);

    // 2. Set tenant context for RLS compliance
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenant.id]);

    // Check existing links for this tag
    const existingCheck = await client.query(
      "SELECT COUNT(*) FROM links WHERE tenant_id = $1 AND tag = $2",
      [tenant.id, targetTag]
    );
    const existingCount = parseInt(existingCheck.rows[0].count, 10);
    console.log(`[Status] Existing links with tag '${targetTag}': ${existingCount}`);

    console.log(`[Progress] Generating ${targetCount} unique short links in batches of 100...`);

    const chunkSize = 100;
    let insertedTotal = 0;
    const generatedCodes = new Set();

    for (let chunkStart = 1; chunkStart <= targetCount; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize - 1, targetCount);
      const batchValues = [];
      const placeholders = [];
      let paramIndex = 1;

      for (let i = chunkStart; i <= chunkEnd; i++) {
        let code = generateShortCode(7);
        while (generatedCodes.has(code)) {
          code = generateShortCode(7);
        }
        generatedCodes.add(code);

        const padNum = String(existingCount + i).padStart(5, '0');
        const destUrl = `https://jupsoft.com/student/portal?id=STD-${padNum}&session=2026-27`;
        const extRef = `BULK-${targetTag.toUpperCase()}-${padNum}`;
        const redirectType = '302';
        const status = 'active';

        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
        );

        batchValues.push(
          tenant.id,
          domainId,
          code,
          destUrl,
          redirectType,
          status,
          targetTag,
          extRef,
          new Date()
        );
      }

      const insertSql = `
        INSERT INTO links (
          tenant_id, domain_id, short_code, destination_url,
          redirect_type, status, tag, external_ref, created_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT DO NOTHING
        RETURNING id, short_code
      `;

      const insertRes = await client.query(insertSql, batchValues);
      insertedTotal += insertRes.rowCount;
      console.log(`  -> Inserted batch ${chunkStart} to ${chunkEnd} (${insertRes.rowCount} links committed)`);
    }

    await client.query("COMMIT");

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: ${insertedTotal} Links Generated with tag '${targetTag}'!`);
    console.log(`Execution Time: ${totalDuration}s (${(insertedTotal / totalDuration).toFixed(0)} links/sec)`);
    console.log(`Short URL Format: https://${domainHost}/<short_code>`);
    console.log(`Filter in UI: Tag Filter -> '#${targetTag}'`);
    console.log(`======================================================\n`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[Fatal Error] Bulk generation failed:`, err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
