import type { CourseAsset } from '../domain/types';

/** Must stay in sync with media-service allowlist. */
export const CLOUD_UPLOAD_CONTENT_TYPES = [
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
] as const;

export function isCloudUploadableContentType(ct: string): boolean {
  const t = ct.trim().toLowerCase();
  return (CLOUD_UPLOAD_CONTENT_TYPES as readonly string[]).includes(t);
}

export function getMediaApiBase(): string {
  const raw = import.meta.env.VITE_MEDIA_API_URL as string | undefined;
  return raw?.replace(/\/$/, '') ?? '';
}

export type SignedUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  method: string;
  headers: { 'Content-Type': string };
  expiresAt: string;
};

export type SignedReadResponse = {
  readUrl: string;
  expiresAt: string;
};

export type DirectUploadResponse = {
  objectKey: string;
  url: string;
};

export async function uploadDirect(
  auth: Record<string, string>,
  file: File,
): Promise<{ ok: true; data: DirectUploadResponse } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };

  const form = new FormData();
  form.append('file', file, file.name);

  const res = await fetch(`${base}/v1/media/upload`, {
    method: 'POST',
    headers: { ...auth },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<DirectUploadResponse>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
  }
  if (!data.objectKey || !data.url) return { ok: false, status: 502, error: 'malformed_response' };
  return { ok: true, data: { objectKey: data.objectKey, url: data.url } };
}

export async function requestSignedUpload(
  auth: Record<string, string>,
  body: { fileName: string; contentType: string },
): Promise<{ ok: true; data: SignedUploadResponse } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/signed-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<SignedUploadResponse>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
  }
  if (!data.uploadUrl || !data.objectKey || !data.headers?.['Content-Type']) {
    return { ok: false, status: 502, error: 'malformed_response' };
  }
  return {
    ok: true,
    data: {
      uploadUrl: data.uploadUrl,
      objectKey: data.objectKey,
      method: data.method ?? 'PUT',
      headers: { 'Content-Type': data.headers['Content-Type'] },
      expiresAt: data.expiresAt ?? '',
    },
  };
}

export async function requestSignedRead(
  auth: Record<string, string>,
  objectKey: string,
): Promise<{ ok: true; readUrl: string } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/signed-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ objectKey }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; readUrl?: string };
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
  }
  if (!data.readUrl) return { ok: false, status: 502, error: 'malformed_response' };
  return { ok: true, readUrl: data.readUrl };
}

/** Opens a link or fetches a short-lived signed read URL for S3-backed materials. */
export async function openCourseAssetInNewTab(
  asset: Pick<CourseAsset, 'url' | 'gcsObjectKey'>,
  getAuthorizationHeader: () => Record<string, string> | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Links can be opened directly.
  if (!asset.gcsObjectKey) {
    if (!asset.url) return { ok: false, message: 'Missing file URL.' };
    window.open(asset.url, '_blank', 'noopener,noreferrer');
    return { ok: true };
  }

  // For files, always request a fresh signed URL so expired URLs are automatically renewed.
  const h = getAuthorizationHeader();
  if (!h) return { ok: false, message: 'You need to be signed in to open this file.' };
  const r = await requestSignedRead(h, asset.gcsObjectKey);
  if (!r.ok) {
    const msg = r.status === 403 ? 'You are not allowed to open this file.' : `Could not open file (${r.error}).`;
    return { ok: false, message: msg };
  }
  window.open(r.readUrl, '_blank', 'noopener,noreferrer');
  return { ok: true };
}
