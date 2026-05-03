import { pool } from '../db/pool.js';
import { config } from '../config.js';

async function main() {
  console.log(`Trying PostgreSQL ${config.DATABASE_USER}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`);
  const r = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  console.log('Database OK:', r.rows[0]);
  await pool.end();
}

main().catch((err: unknown) => {
  console.error(err);
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'ETIMEDOUT') {
    console.error(`
ETIMEDOUT usually means packets never reached Postgres (blocked path), not wrong password.

Checklist:
  1) GCP Console → Cloud SQL → your instance → Connections → Networking
     - Public IP enabled.
     - "Authorized networks": add YOUR current public egress IP (/32).
       (From WSL, this is usually your router/ISP IP — search "what is my ip" from the same machine.)
  2) If the instance uses only Private IP, public TCP from your laptop will timeout — use
     Cloud SQL Auth Proxy, a bastion/VPN, or run the service inside GCP/VPC with access.
  3) Firewall/ISP blocking outbound port 5432 — try Cloud SQL Auth Proxy or another network.
`);
  }
  if (code === 'ECONNREFUSED') {
    console.error(`
ECONNREFUSED: reachable host but nothing accepting on that port —
wrong DATABASE_PORT, or Postgres not listening on that interface.
`);
  }
  process.exit(1);
});
