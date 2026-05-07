import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

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

if (process.env.MEDIA_SERVICE_PORT) {
  process.env.PORT = process.env.MEDIA_SERVICE_PORT;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8083),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  JWT_SECRET: z.string().trim().min(16, 'JWT_SECRET must be at least 16 characters'),

  AWS_REGION: z.string().trim().min(1),

  /** Bucket for tenant media (no s3:// prefix). */
  S3_MEDIA_BUCKET: z.string().trim().min(1),

  /**
   * Optional base URL for public object access (no trailing slash).
   * If empty, defaults to `https://{bucket}.s3.{region}.amazonaws.com`.
   */
  S3_PUBLIC_BASE_URL: z.string().trim().optional().default(''),

  /** Logical prefix inside the bucket; objects live under `${prefix}/${schoolId}/…`. */
  S3_TENANT_PREFIX: z.string().trim().default('tenants'),

  MEDIA_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(24 * 3600).default(3600),

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
