import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { getS3Client } from './s3Client.js';

const UPLOAD_ROLES = new Set(['platform_master', 'teacher', 'teaching_assistant']);

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
  const p = config.S3_TENANT_PREFIX.replace(/^\/+|\/+$/g, '');
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

  const ttlSeconds = config.MEDIA_SIGNED_URL_TTL_SECONDS;
  const expires = Date.now() + ttlSeconds * 1000;

  const s3 = getS3Client();
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.S3_MEDIA_BUCKET,
      Key: objectKey,
      ContentType: params.contentType.trim(),
    }),
    { expiresIn: ttlSeconds },
  );

  return {
    objectKey,
    uploadUrl,
    expiresAt: new Date(expires).toISOString(),
  };
}

export async function signReadUrl(objectKey: string): Promise<{ readUrl: string; expiresAt: string }> {
  const ttlSeconds = config.MEDIA_SIGNED_URL_TTL_SECONDS;
  const expires = Date.now() + ttlSeconds * 1000;

  const s3 = getS3Client();
  const readUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.S3_MEDIA_BUCKET,
      Key: objectKey.replace(/^\/+/, ''),
    }),
    { expiresIn: ttlSeconds },
  );

  return {
    readUrl,
    expiresAt: new Date(expires).toISOString(),
  };
}

export async function uploadObjectDirect(params: {
  schoolId: string;
  userId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ objectKey: string }> {
  assertAllowedContentType(params.contentType);
  const safe = sanitizeFileBase(params.fileName);
  const objectKey = `${tenantRoot(params.schoolId)}/media/${params.userId}/${randomUUID()}-${safe}`;

  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_MEDIA_BUCKET,
      Key: objectKey,
      Body: params.bytes,
      ContentType: params.contentType.trim(),
    }),
  );

  return { objectKey };
}

export async function uploadObjectStream(params: {
  schoolId: string;
  userId: string;
  fileName: string;
  contentType: string;
  stream: Readable;
}): Promise<{ objectKey: string }> {
  assertAllowedContentType(params.contentType);
  const safe = sanitizeFileBase(params.fileName);
  const objectKey = `${tenantRoot(params.schoolId)}/media/${params.userId}/${randomUUID()}-${safe}`;

  const s3 = getS3Client();
  const up = new Upload({
    client: s3,
    params: {
      Bucket: config.S3_MEDIA_BUCKET,
      Key: objectKey,
      Body: params.stream,
      ContentType: params.contentType.trim(),
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
    leavePartsOnError: false,
  });
  await up.done();
  return { objectKey };
}

export function publicObjectUrl(objectKey: string): string {
  const base =
    config.S3_PUBLIC_BASE_URL.trim() ||
    `https://${config.S3_MEDIA_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com`;
  const key = objectKey.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${base}/${key}`;
}

export async function deleteObject(objectKey: string): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.S3_MEDIA_BUCKET,
      Key: objectKey.replace(/^\/+/, ''),
    }),
  );
}

export async function objectExists(objectKey: string): Promise<boolean> {
  const s3 = getS3Client();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: config.S3_MEDIA_BUCKET,
        Key: objectKey.replace(/^\/+/, ''),
      }),
    );
    return true;
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

