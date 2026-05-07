import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  canRequestRead,
  canRequestUpload,
  objectKeyBelongsToSchool,
  publicObjectUrl,
  signReadUrl,
  signUploadUrl,
  uploadObjectDirect,
} from '../services/s3Media.service.js';
import { isMissingAwsCredentials } from '../util/signingErrors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const signedUploadBody = z.object({
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(3).max(200),
});

const signedReadBody = z.object({
  objectKey: z.string().trim().min(1).max(1024),
});

export function mediaRouter() {
  const r = Router();
  r.use(requireAuth);

  // One-step upload for local testing (Postman/curl). Browser flow should use presigned URLs instead.
  r.post('/upload', upload.single('file'), async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canRequestUpload(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const f = req.file;
      if (!f || !Buffer.isBuffer(f.buffer)) {
        res.status(400).json({ error: 'missing_file', hint: 'Send multipart/form-data with field name "file".' });
        return;
      }
      if (!f.mimetype) {
        res.status(400).json({ error: 'missing_content_type' });
        return;
      }
      const out = await uploadObjectDirect({
        schoolId: auth.schoolId,
        userId: auth.userId,
        fileName: f.originalname || 'file',
        contentType: f.mimetype,
        bytes: f.buffer,
      });
      res.status(201).json({ objectKey: out.objectKey, url: publicObjectUrl(out.objectKey) });
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
