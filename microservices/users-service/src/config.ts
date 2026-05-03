import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/** Prefer `microservices/.env`; fall back to this service’s local `.env`. */
function loadMicroservicesEnv(importMetaUrl: string): void {
  const srcDir = dirname(fileURLToPath(importMetaUrl));
  const serviceRoot = resolve(srcDir, '..');
  const microservicesRoot = resolve(serviceRoot, '..');
  const shared = resolve(microservicesRoot, '.env');
  if (existsSync(shared)) {
    loadDotenv({ path: shared, override: true });
    return;
  }
  const legacy = resolve(serviceRoot, '.env');
  if (existsSync(legacy)) {
    loadDotenv({ path: legacy, override: true });
  }
}

loadMicroservicesEnv(import.meta.url);

if (process.env.USERS_SERVICE_PORT) {
  process.env.PORT = process.env.USERS_SERVICE_PORT;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8082),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  JWT_SECRET: z.string().trim().min(16, 'JWT_SECRET must be at least 16 characters'),

  DATABASE_HOST: z.string().default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().default(''),

  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  DATABASE_INSTANCE_CONNECTION: z.string().optional().default(''),
  DATABASE_SOCKET: z.string().optional().default(''),

  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export function corsOrigins(): string | string[] | boolean {
  const raw = config.CORS_ORIGIN.trim();
  if (raw === '*') return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0]! : list;
}
