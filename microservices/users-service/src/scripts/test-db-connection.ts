import { config } from '../config.js';
import { pool } from '../db/pool.js';

async function main() {
  console.log(
    `Trying PostgreSQL ${config.DATABASE_USER}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`,
  );
  const r = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  console.log('Database OK:', r.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
