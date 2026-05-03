import type { UserRole } from '../domain/types';

export type UserPublicDto = {
  userId: string;
  schoolId: string;
  userName: string;
  email: string;
  role: UserRole | string;
  active: boolean;
  createdAt: string;
};

export function getUsersApiBase(): string | null {
  const raw = import.meta.env.VITE_USERS_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/** `GET /v1/users` — staff-only on backend */
export async function fetchUsersDirectory(
  authHeaders: Record<string, string>,
): Promise<
  | { ok: true; users: UserPublicDto[] }
  | { ok: false; status: number; error: string }
> {
  const base = getUsersApiBase();
  if (!base) return { ok: false, status: 0, error: 'missing_users_url' };

  try {
    const res = await fetch(`${base}/v1/users`, {
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
    const users = (data as { users?: UserPublicDto[] }).users;
    if (!Array.isArray(users)) return { ok: false, status: res.status, error: 'malformed_response' };
    return { ok: true, users };
  } catch {
    return { ok: false, status: 0, error: 'network_error' };
  }
}
