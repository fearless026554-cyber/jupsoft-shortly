const { Client } = require('pg');
const client = new Client({
  host: '127.0.0.1',
  port: 5433,
  database: 'jlmp_db',
  user: 'postgres',
  password: 'viraj',
});

async function run() {
  await client.connect();
  console.log('Altering links.short_code to VARCHAR(64)...');
  await client.query('ALTER TABLE links ALTER COLUMN short_code TYPE VARCHAR(64);');
  const res = await client.query(`
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'links' AND column_name = 'short_code'
  `);
  console.log('Result:', res.rows[0]);
  await client.end();
}
run().catch(console.error);
