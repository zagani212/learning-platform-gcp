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
  url?: string;
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
  if (!data.objectKey) return { ok: false, status: 502, error: 'malformed_response' };
  return { ok: true, data: { objectKey: data.objectKey, url: data.url } };
}

export function uploadDirectWithProgress(params: {
  auth: Record<string, string>;
  file: File;
  onProgress: (p: { loaded: number; total?: number; percent?: number }) => void;
}): Promise<{ ok: true; data: DirectUploadResponse } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return Promise.resolve({ ok: false, status: 0, error: 'media_api_not_configured' });

  const form = new FormData();
  form.append('file', params.file, params.file.name);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/v1/media/upload`);
    for (const [k, v] of Object.entries(params.auth)) xhr.setRequestHeader(k, v);

    xhr.upload.onprogress = (e) => {
      const total = e.lengthComputable ? e.total : undefined;
      const percent = total ? Math.round((e.loaded / total) * 100) : undefined;
      params.onProgress({ loaded: e.loaded, total, percent });
    };

    xhr.onerror = () => resolve({ ok: false, status: 0, error: 'network_error' });
    xhr.onabort = () => resolve({ ok: false, status: 0, error: 'aborted' });

    xhr.onload = () => {
      const status = xhr.status || 0;
      const raw = xhr.responseText || '';
      const parsed = (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return {};
        }
      })();

      if (status < 200 || status >= 300) {
        const o = parsed as { error?: unknown };
        resolve({
          ok: false,
          status,
          error: typeof o.error === 'string' ? o.error : 'request_failed',
        });
        return;
      }

      const o = parsed as Partial<DirectUploadResponse>;
      if (!o.objectKey) {
        resolve({ ok: false, status: 502, error: 'malformed_response' });
        return;
      }
      resolve({ ok: true, data: { objectKey: o.objectKey, url: o.url } });
    };

    xhr.send(form);
  });
}

export function putWithProgress(params: {
  url: string;
  contentType: string;
  body: Blob;
  onProgress: (p: { loaded: number; total?: number; percent?: number }) => void;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', params.url);
    xhr.setRequestHeader('Content-Type', params.contentType);

    xhr.upload.onprogress = (e) => {
      const total = e.lengthComputable ? e.total : undefined;
      const percent = total ? Math.round((e.loaded / total) * 100) : undefined;
      params.onProgress({ loaded: e.loaded, total, percent });
    };

    xhr.onerror = () => resolve({ ok: false, status: 0, error: 'network_error' });
    xhr.onabort = () => resolve({ ok: false, status: 0, error: 'aborted' });
    xhr.onload = () => {
      const status = xhr.status || 0;
      if (status >= 200 && status < 300) resolve({ ok: true });
      else resolve({ ok: false, status, error: 'upload_failed' });
    };

    xhr.send(params.body);
  });
}

export async function deleteMediaObject(
  auth: Record<string, string>,
  objectKey: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/object`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ objectKey }),
  });
  if (res.status === 204) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
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

export type UploadJobCreateResponse = SignedUploadResponse & { jobId: string };

export async function createUploadJob(
  auth: Record<string, string>,
  body: { fileName: string; contentType: string },
): Promise<{ ok: true; data: UploadJobCreateResponse } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/upload-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<UploadJobCreateResponse>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
  }
  if (!data.jobId || !data.uploadUrl || !data.objectKey || !data.headers?.['Content-Type']) {
    return { ok: false, status: 502, error: 'malformed_response' };
  }
  return {
    ok: true,
    data: {
      jobId: data.jobId,
      uploadUrl: data.uploadUrl,
      objectKey: data.objectKey,
      method: data.method ?? 'PUT',
      headers: { 'Content-Type': data.headers['Content-Type'] },
      expiresAt: data.expiresAt ?? '',
    },
  };
}

export async function completeUploadJob(
  auth: Record<string, string>,
  jobId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/upload-jobs/${encodeURIComponent(jobId)}/complete`, {
    method: 'POST',
    headers: { ...auth },
  });
  if (res.status === 202) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
}

export type UploadJobStatus = {
  jobId: string;
  objectKey: string;
  status: 'created' | 'uploading' | 'uploaded' | 'failed';
  updatedAt: number;
  error?: string;
};

export async function getUploadJob(
  auth: Record<string, string>,
  jobId: string,
): Promise<{ ok: true; job: UploadJobStatus } | { ok: false; status: number; error: string }> {
  const base = getMediaApiBase();
  if (!base) return { ok: false, status: 0, error: 'media_api_not_configured' };
  const res = await fetch(`${base}/v1/media/upload-jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: { ...auth },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; job?: UploadJobStatus };
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : 'request_failed' };
  }
  if (!data.job?.jobId) return { ok: false, status: 502, error: 'malformed_response' };
  return { ok: true, job: data.job };
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

/** Resolves a URL for viewing an asset (renews signed URLs). */
export async function resolveCourseAssetUrl(
  asset: Pick<CourseAsset, 'url' | 'gcsObjectKey'>,
  getAuthorizationHeader: () => Record<string, string> | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  // Links can be opened directly.
  if (!asset.gcsObjectKey) {
    if (!asset.url) return { ok: false, message: 'Missing file URL.' };
    return { ok: true, url: asset.url };
  }

  // For files, always request a fresh signed URL so expired URLs are automatically renewed.
  const h = getAuthorizationHeader();
  if (!h) return { ok: false, message: 'You need to be signed in to open this file.' };
  const r = await requestSignedRead(h, asset.gcsObjectKey);
  if (!r.ok) {
    const msg = r.status === 403 ? 'You are not allowed to open this file.' : `Could not open file (${r.error}).`;
    return { ok: false, message: msg };
  }
  return { ok: true, url: r.readUrl };
}
