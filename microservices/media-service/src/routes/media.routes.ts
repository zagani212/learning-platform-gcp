import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  canRequestRead,
  canRequestUpload,
  objectKeyBelongsToSchool,
  signReadUrl,
  signUploadUrl,
} from '../services/gcsMedia.service.js';
import { isImpersonationPrincipalNotFound, isMissingServiceAccountForSigning } from '../util/signingErrors.js';

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
      if (isImpersonationPrincipalNotFound(e)) {
        res.status(503).json({
          error: 'impersonation_principal_not_found',
          hint:
            'Google does not recognize that service account email. In Console → IAM → Service Accounts, open the account and copy the Email exactly (character-for-character). The part before @ must match the account id; the part after @ must be YOUR_PROJECT_ID.iam.gserviceaccount.com where PROJECT_ID is from Project settings → Project ID (not the display name).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      if (isMissingServiceAccountForSigning(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'V4 signed URLs need either (1) GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON key, or (2) ADC plus GCS_IMPERSONATE_SERVICE_ACCOUNT (your user needs roles/iam.serviceAccountTokenCreator on that SA), or (3) a workload service account on GCP. Plain application-default user login cannot sign.',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

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
      if (isImpersonationPrincipalNotFound(e)) {
        res.status(503).json({
          error: 'impersonation_principal_not_found',
          hint:
            'Google does not recognize that service account email. In Console → IAM → Service Accounts, open the account and copy the Email exactly (character-for-character). The part before @ must match the account id; the part after @ must be YOUR_PROJECT_ID.iam.gserviceaccount.com where PROJECT_ID is from Project settings → Project ID (not the display name).',
          ...(config.NODE_ENV === 'development' ? { detail: (e as Error).message } : {}),
        });
        return;
      }
      if (isMissingServiceAccountForSigning(e)) {
        res.status(503).json({
          error: 'signing_credentials',
          hint:
            'V4 signed URLs need either (1) GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON key, or (2) ADC plus GCS_IMPERSONATE_SERVICE_ACCOUNT (your user needs roles/iam.serviceAccountTokenCreator on that SA), or (3) a workload service account on GCP. Plain application-default user login cannot sign.',
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
