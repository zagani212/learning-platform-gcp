export type SchoolDto = {
  schoolId: string;
  name: string;
  slug: string;
  createdAt: string;
};

export function getSchoolsApiBase(): string | null {
  const raw = import.meta.env.VITE_SCHOOLS_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/** `GET /v1/schools` — Bearer required; backend allows `school_admin` only. */
export async function fetchSchoolsDirectory(
  authHeaders: Record<string, string>,
): Promise<
  | { ok: true; schools: SchoolDto[] }
  | { ok: false; status: number; error: string }
> {
  const base = getSchoolsApiBase();
  if (!base) return { ok: false, status: 0, error: 'missing_schools_url' };

  try {
    const res = await fetch(`${base}/v1/schools`, {
      headers: {
        Accept: 'application/json',
        ...authHeaders,
      },
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const o = data as { error?: unknown; detail?: unknown };
      const code = o.error != null ? String(o.error) : 'request_failed';
      const detail = o.detail != null ? String(o.detail) : '';
      const err = detail ? `${code} — ${detail}` : code;
      return { ok: false, status: res.status, error: err };
    }
    const schools = (data as { schools?: SchoolDto[] }).schools;
    if (!Array.isArray(schools)) return { ok: false, status: res.status, error: 'malformed_response' };
    return { ok: true, schools };
  } catch {
    return { ok: false, status: 0, error: 'network_error' };
  }
}
