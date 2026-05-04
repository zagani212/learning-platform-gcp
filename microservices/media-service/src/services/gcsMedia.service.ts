import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { getStorage } from './gcsStorageClient.js';

const UPLOAD_ROLES = new Set(['teacher', 'teaching_assistant']);

const READ_ROLES = new Set([
  'platform_master',
  'school_admin',
  'teacher',
  'teaching_assistant',
  'student',
]);

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function tenantRoot(schoolId: string): string {
  const p = config.GCS_TENANT_PREFIX.replace(/^\/+|\/+$/g, '');
  return `${p}/${schoolId}`;
}

export function objectKeyBelongsToSchool(objectKey: string, schoolId: string): boolean {
  const root = tenantRoot(schoolId);
  const normalized = objectKey.replace(/^\/+/, '');
  if (normalized.includes('..')) return false;
  return normalized === root || normalized.startsWith(`${root}/`);
}

export function sanitizeFileBase(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').trim();
  const cleaned = base.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  return cleaned || 'file';
}

export function canRequestUpload(role: string): boolean {
  return UPLOAD_ROLES.has(role);
}

export function canRequestRead(role: string): boolean {
  return READ_ROLES.has(role);
}

export function assertAllowedContentType(contentType: string): void {
  const ct = contentType.trim().toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.has(ct)) {
    const err = new Error('unsupported_content_type') as Error & { code?: string };
    err.code = 'UNSUPPORTED_TYPE';
    throw err;
  }
}

export async function signUploadUrl(params: {
  schoolId: string;
  userId: string;
  fileName: string;
  contentType: string;
}): Promise<{ objectKey: string; uploadUrl: string; expiresAt: string }> {
  assertAllowedContentType(params.contentType);
  const safe = sanitizeFileBase(params.fileName);
  const objectKey = `${tenantRoot(params.schoolId)}/media/${params.userId}/${randomUUID()}-${safe}`;
  const storage = await getStorage();
  const bucket = storage.bucket(config.GCS_MEDIA_BUCKET);
  const file = bucket.file(objectKey);
  const ttlMs = config.MEDIA_SIGNED_URL_TTL_SECONDS * 1000;
  const expires = Date.now() + ttlMs;

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires,
    contentType: params.contentType.trim(),
  });

  return {
    objectKey,
    uploadUrl,
    expiresAt: new Date(expires).toISOString(),
  };
}

export async function signReadUrl(objectKey: string): Promise<{ readUrl: string; expiresAt: string }> {
  const storage = await getStorage();
  const bucket = storage.bucket(config.GCS_MEDIA_BUCKET);
  const file = bucket.file(objectKey);
  const ttlMs = config.MEDIA_SIGNED_URL_TTL_SECONDS * 1000;
  const expires = Date.now() + ttlMs;
  const [readUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
  });
  return {
    readUrl,
    expiresAt: new Date(expires).toISOString(),
  };
}
