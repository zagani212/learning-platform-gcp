import { Router } from 'express';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  canRequestRead,
  canRequestUpload,
  deleteObject,
  objectKeyBelongsToSchool,
  objectExists,
  publicObjectUrl,
  signReadUrl,
  signUploadUrl,
  uploadObjectDirect,
  uploadObjectStream,
} from '../services/s3Media.service.js';
import { isMissingAwsCredentials } from '../util/signingErrors.js';

const deleteBody = z.object({
  objectKey: z.string().trim().min(1).max(1024),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MEDIA_MAX_UPLOAD_MB * 1024 * 1024,
  },
});

const signedUploadBody = z.object({
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(200),
});

const signedReadBody = z.object({
  objectKey: z.string().trim().min(1).max(1024),
});

const createJobBody = z.object({
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(200),
});

type UploadJob = {
  jobId: string;
  objectKey: string;
  status: 'created' | 'uploading' | 'uploaded' | 'failed';
  updatedAt: number;
  error?: string;
};

const jobs = new Map<string, UploadJob>();

export function mediaRouter() {
  const r = Router();
  r.use(requireAuth);

  r.post('/upload-jobs', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestUpload(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const parsed = createJobBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { fileName, contentType } = parsed.data;
      const out = await signUploadUrl({
        schoolId: auth.schoolId,
        userId: auth.userId,
        fileName,
        contentType,
      });
      const jobId = crypto.randomUUID();
      jobs.set(jobId, {
        jobId,
        objectKey: out.objectKey,
        status: 'created',
        updatedAt: Date.now(),
      });
      res.status(201).json({
        jobId,
        uploadUrl: out.uploadUrl,
        objectKey: out.objectKey,
        method: 'PUT',
        headers: { 'Content-Type': contentType.trim() },
        expiresAt: out.expiresAt,
      });
    } catch (e) {
      if (isMissingAwsCredentials(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'S3 presigned URLs require AWS credentials. On AWS, attach an IAM role (instance profile / task role); locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/upload-jobs/:jobId', (req, res) => {
    const auth = req.auth!;
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'missing_job_id' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    if (!objectKeyBelongsToSchool(job.objectKey, auth.schoolId)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.json({ job });
  });

  r.get('/upload-jobs/:jobId/events', (req, res) => {
    const auth = req.auth!;
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'missing_job_id' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    if (!objectKeyBelongsToSchool(job.objectKey, auth.schoolId)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = () => {
      const j = jobs.get(jobId);
      if (!j) {
        res.write(`event: done\ndata: ${JSON.stringify({ status: 'failed', error: 'job_not_found' })}\n\n`);
        res.end();
        return;
      }
      res.write(`event: status\ndata: ${JSON.stringify(j)}\n\n`);
      if (j.status === 'uploaded' || j.status === 'failed') {
        res.write(`event: done\ndata: ${JSON.stringify(j)}\n\n`);
        res.end();
      }
    };

    const timer = setInterval(send, 1500);
    send();
    req.on('close', () => clearInterval(timer));
  });

  r.post('/upload-jobs/:jobId/complete', async (req, res) => {
    const auth = req.auth!;
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'missing_job_id' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    if (!objectKeyBelongsToSchool(job.objectKey, auth.schoolId)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Ack immediately; verification happens async.
    job.status = 'uploading';
    job.updatedAt = Date.now();
    jobs.set(jobId, job);
    res.status(202).json({ ok: true, jobId });

    void (async () => {
      try {
        const exists = await objectExists(job.objectKey);
        if (!exists) {
          const next: UploadJob = {
            ...job,
            status: 'failed',
            updatedAt: Date.now(),
            error: 'object_not_found',
          };
          jobs.set(jobId, next);
          return;
        }
        const next: UploadJob = { ...job, status: 'uploaded', updatedAt: Date.now() };
        jobs.set(jobId, next);
      } catch (e) {
        const next: UploadJob = {
          ...job,
          status: 'failed',
          updatedAt: Date.now(),
          error: (e as Error)?.message || 'unknown_error',
        };
        jobs.set(jobId, next);
      }
    })();
  });

  r.delete('/object', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestUpload(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const parsed = deleteBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { objectKey } = parsed.data;
      if (!objectKeyBelongsToSchool(objectKey, auth.schoolId)) {
        res.status(403).json({ error: 'forbidden', reason: 'object_not_in_tenant' });
        return;
      }
      await deleteObject(objectKey);
      res.status(204).end();
    } catch (e) {
      if (isMissingAwsCredentials(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'S3 operations require AWS credentials. On AWS, attach an IAM role (instance profile / task role); locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  // One-step upload for local testing (Postman/curl). Browser flow should use presigned URLs instead.
  r.post('/upload', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestUpload(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Stream multipart/form-data directly to S3 (multipart upload).
      const bb = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: config.MEDIA_MAX_UPLOAD_MB * 1024 * 1024,
        },
      });

      let done = false;
      let gotFile = false;

      const finish = (status: number, body: unknown) => {
        if (done) return;
        done = true;
        res.status(status).json(body);
      };

      bb.on('file', async (_field, stream, info) => {
        if (gotFile) {
          stream.resume();
          return;
        }
        gotFile = true;
        const fileName = info.filename || 'file';
        const contentType = info.mimeType || '';
        if (!contentType) {
          stream.resume();
          finish(400, { error: 'missing_content_type' });
          return;
        }

        try {
          const out = await uploadObjectStream({
            schoolId: auth.schoolId,
            userId: auth.userId,
            fileName,
            contentType,
            stream,
          });
          finish(201, { objectKey: out.objectKey, url: publicObjectUrl(out.objectKey) });
        } catch (e: unknown) {
          const err = e as { code?: string };
          if (err?.code === 'UNSUPPORTED_TYPE') {
            finish(400, { error: 'unsupported_content_type' });
            return;
          }
          if (isMissingAwsCredentials(e)) {
            finish(503, {
              error: 'signing_credentials',
              hint:
                'Direct S3 uploads require AWS credentials too. On AWS, attach an IAM role (instance profile / task role); locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
              ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
            });
            return;
          }
          console.error(e);
          finish(503, { error: 'service_unavailable' });
        }
      });

      bb.on('filesLimit', () => finish(400, { error: 'too_many_files' }));
      bb.on('error', () => finish(400, { error: 'invalid_upload' }));
      bb.on('close', () => {
        if (!done && !gotFile) finish(400, { error: 'missing_file' });
      });

      bb.on('limit', () => {
        finish(413, { error: 'file_too_large', maxMb: config.MEDIA_MAX_UPLOAD_MB });
      });

      req.pipe(bb);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === 'UNSUPPORTED_TYPE') {
        res.status(400).json({ error: 'unsupported_content_type' });
        return;
      }
      if (isMissingAwsCredentials(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'Direct S3 uploads require AWS credentials too. On AWS, attach an IAM role (instance profile / task role); locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  // Deprecated: presigned URL flow (kept for later re-enable)
  r.post('/signed-upload', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestUpload(auth.role)) {
        res.status(403).json({ error: 'forbidden', reason: 'upload_requires_teacher' });
        return;
      }
      const parsed = signedUploadBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { fileName, contentType } = parsed.data;
      const out = await signUploadUrl({
        schoolId: auth.schoolId,
        userId: auth.userId,
        fileName,
        contentType,
      });
      res.json({
        uploadUrl: out.uploadUrl,
        objectKey: out.objectKey,
        method: 'PUT',
        headers: { 'Content-Type': contentType.trim() },
        expiresAt: out.expiresAt,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === 'UNSUPPORTED_TYPE') {
        res.status(400).json({ error: 'unsupported_content_type' });
        return;
      }
      if (isMissingAwsCredentials(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'S3 presigned URLs require AWS credentials. On AWS, attach an IAM role (instance profile / task role) to the compute runtime; locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  // Deprecated: presigned URL flow (kept for later re-enable)
  r.post('/signed-read', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestRead(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const parsed = signedReadBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { objectKey } = parsed.data;
      if (!objectKeyBelongsToSchool(objectKey, auth.schoolId)) {
        res.status(403).json({ error: 'forbidden', reason: 'object_not_in_tenant' });
        return;
      }
      const out = await signReadUrl(objectKey);
      res.json({ readUrl: out.readUrl, expiresAt: out.expiresAt });
    } catch (e) {
      if (isMissingAwsCredentials(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'S3 presigned URLs require AWS credentials. On AWS, attach an IAM role (instance profile / task role) to the compute runtime; locally, set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_REGION).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  return r;
}
