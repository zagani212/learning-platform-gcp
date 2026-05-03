import type { UserRole } from '../domain/types';

export type LoginSuccessBody = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    userId: string;
    schoolId: string;
    userName: string;
    email: string;
    role: string;
  };
};

export function getAuthApiBase(): string | null {
  const raw = import.meta.env.VITE_AUTH_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/** POST /v1/auth/login */
export async function requestLogin(email: string, password: string): Promise<
  | { ok: true; body: LoginSuccessBody }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const base = getAuthApiBase();
  if (!base) {
    return { ok: false, status: 0, error: 'missing_auth_url' };
  }

  try {
    const res = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'request_failed';
      return { ok: false, status: res.status, error: err, details: data };
    }

    const body = data as LoginSuccessBody;
    if (
      !body?.accessToken ||
      !body?.user?.userId ||
      !body?.user?.schoolId ||
      !body?.user?.role
    ) {
      return { ok: false, status: res.status, error: 'malformed_auth_response', details: data };
    }

    return { ok: true, body };
  } catch {
    return { ok: false, status: 0, error: 'network_error' };
  }
}

const ROLES: UserRole[] = [
  'platform_master',
  'school_admin',
  'teacher',
  'teaching_assistant',
  'student',
];

export function parseUserRole(role: string): UserRole | null {
  return ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}
