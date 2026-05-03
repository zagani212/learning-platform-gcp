/**
 * Generates a bcrypt hash for storing in users.password_hash.
 * Usage: `cd microservices/auth-service && npx tsx src/scripts/hash-password.ts 'YourPassword'`
 *
 * Loads **`microservices/.env`** first (then local **`<service>/.env`**), same as **`config.ts`**.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

{
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const serviceRoot = resolve(srcDir, '..', '..');
  const msRoot = resolve(serviceRoot, '..');
  const shared = resolve(msRoot, '.env');
  if (existsSync(shared)) loadDotenv({ path: shared, override: true });
  else loadDotenv({ path: resolve(serviceRoot, '.env'), override: true });
}

const rounds = z.coerce
  .number()
  .int()
  .min(4)
  .max(16)
  .default(12)
  .parse(process.env.BCRYPT_ROUNDS ?? '12');

const pwd = process.argv[2]?.trim();

if (!pwd) {
  console.error('Usage: tsx hash-password.ts <plain-password>');
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(pwd, rounds);
  console.log(hash);
}

await main();
