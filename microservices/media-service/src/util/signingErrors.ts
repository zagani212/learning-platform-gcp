/** IAM could not resolve the impersonation target (wrong email, wrong project, or SA deleted). */
export function isImpersonationPrincipalNotFound(e: unknown): boolean {
  const msg = typeof (e as Error)?.message === 'string' ? (e as Error).message : '';
  return (
    msg.includes('Gaia id not found') ||
    msg.includes('Unknown service account') ||
    /NOT_FOUND.*iam\.gserviceaccount\.com/i.test(msg)
  );
}

/** User ADC from `gcloud auth application-default login` cannot sign V4 URLs (no `client_email`). */
export function isMissingServiceAccountForSigning(e: unknown): boolean {
  if (isImpersonationPrincipalNotFound(e)) return false;
  const err = e as { name?: string; message?: string };
  const msg = typeof err?.message === 'string' ? err.message : '';
  return err?.name === 'SigningError' || msg.includes('client_email') || msg.includes('Cannot sign data');
}
