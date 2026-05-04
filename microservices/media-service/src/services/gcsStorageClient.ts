import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { config } from '../config.js';

let storagePromise: Promise<Storage> | null = null;

/**
 * Storage client: default ADC/key file, or optional impersonation (no JSON key for the target SA).
 */
export function getStorage(): Promise<Storage> {
  if (!storagePromise) {
    storagePromise = buildStorage();
  }
  return storagePromise;
}

function resolveProjectId(): string {
  return (
    config.GCP_PROJECT_ID.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    ''
  );
}

function projectFromServiceAccountEmail(email: string): string {
  const m = /^[^@]+@([^.]+)\.iam\.gserviceaccount\.com$/i.exec(email.trim());
  return m?.[1] ?? '';
}

async function buildStorage(): Promise<Storage> {
  const raw = config.GCS_IMPERSONATE_SERVICE_ACCOUNT.trim();
  if (!raw) {
    return new Storage();
  }

  const projectId = resolveProjectId();
  const targetPrincipal = raw.includes('@')
    ? raw.trim()
    : `${raw.trim()}@${projectId}.iam.gserviceaccount.com`;

  if (!targetPrincipal.includes('@')) {
    throw new Error(
      'GCS_IMPERSONATE_SERVICE_ACCOUNT must be a full ...@PROJECT.iam.gserviceaccount.com email, or a short id with GCP_PROJECT_ID / GOOGLE_CLOUD_PROJECT set',
    );
  }

  const derivedProject = projectId || projectFromServiceAccountEmail(targetPrincipal);
  if (!derivedProject) {
    throw new Error(
      'Could not determine GCP project id. Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT, or use the full service account email in GCS_IMPERSONATE_SERVICE_ACCOUNT',
    );
  }

  const auth = new GoogleAuth({
    projectId: derivedProject,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const sourceClient = await auth.getClient();
  const impersonated = new Impersonated({
    sourceClient,
    targetPrincipal,
    delegates: [],
    targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
    lifetime: 3600,
  });

  return new Storage({
    projectId: derivedProject,
    authClient: impersonated,
  });
}
