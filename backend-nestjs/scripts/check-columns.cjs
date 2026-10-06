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
  const res = await client.query(`
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'links' AND column_name IN ('short_code', 'alias')
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
