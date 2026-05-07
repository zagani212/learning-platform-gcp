export function isMissingAwsCredentials(e: unknown): boolean {
  const err = e as { name?: string; message?: string; Code?: string; code?: string };
  const name = typeof err?.name === 'string' ? err.name : '';
  const msg = typeof err?.message === 'string' ? err.message : '';
  const code = typeof err?.code === 'string' ? err.code : typeof err?.Code === 'string' ? err.Code : '';

  return (
    name === 'CredentialsProviderError' ||
    code === 'CredentialsProviderError' ||
    msg.includes('Could not load credentials') ||
    msg.includes('Could not load credentials from any providers') ||
    msg.includes('Missing credentials') ||
    msg.includes('Resolved credential object is not valid')
  );
}
