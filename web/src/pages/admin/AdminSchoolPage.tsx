import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  fetchSchoolsDirectory,
  getSchoolsApiBase,
  type SchoolDto,
} from '../../lib/schoolsApi';
import type { UserRole } from '../../domain/types';
import { roleLabel } from '../../lib/roles';
import {
  fetchUsersDirectory,
  getUsersApiBase,
  type UserPublicDto,
} from '../../lib/usersDirectoryApi';
import { usePlatform } from '../../state/PlatformContext';

function roleLabelSafe(role: string): string {
  const roles: readonly UserRole[] = [
    'platform_master',
    'school_admin',
    'teacher',
    'teaching_assistant',
    'student',
  ];
  if (roles.includes(role as UserRole)) return roleLabel(role as UserRole);
  return role;
}

export function AdminSchoolPage() {
  const { accessToken, getAuthorizationHeader, currentSchool, currentUser } = usePlatform();
  const [schools, setSchools] = useState<SchoolDto[]>([]);
  const [users, setUsers] = useState<UserPublicDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (!accessToken) {
        setSchools([]);
        setUsers([]);
        setError('You need to be signed in to load directory data.');
        return;
      }

      const authHeaders = getAuthorizationHeader();
      if (!authHeaders) {
        setError('Missing access token.');
        return;
      }

      if (!getSchoolsApiBase() || !getUsersApiBase()) {
        setError(
          'Set VITE_SCHOOLS_API_URL and VITE_USERS_API_URL in web/.env (see web/.env.example).',
        );
        setSchools([]);
        setUsers([]);
        return;
      }

      const [sRes, uRes] = await Promise.all([
        fetchSchoolsDirectory(authHeaders),
        fetchUsersDirectory(authHeaders),
      ]);

      const errors: string[] = [];
      if (!sRes.ok) {
        if (sRes.status === 403)
          errors.push('Schools API: forbidden (needs school_admin or platform_master).');
        else if (sRes.error === 'network_error')
          errors.push('Schools API: could not reach the server.');
        else if (sRes.status === 401 && sRes.error.startsWith('token_expired'))
          errors.push('Schools API: session expired — sign out and sign in again.');
        else if (sRes.status === 401 && sRes.error.includes('invalid_token'))
          errors.push(
            `Schools API: ${sRes.error} (ensure microservices/.env JWT_SECRET matches across auth, schools, and users; restart all three after changing it).`,
          );
        else errors.push(`Schools API: ${sRes.error}`);
        setSchools([]);
      } else {
        setSchools(sRes.schools);
      }

      if (!uRes.ok) {
        if (uRes.status === 403) errors.push('Users API: forbidden.');
        else if (uRes.error === 'network_error')
          errors.push('Users API: could not reach the server.');
        else if (uRes.status === 401 && uRes.error.startsWith('token_expired'))
          errors.push('Users API: session expired — sign out and sign in again.');
        else if (uRes.status === 401 && uRes.error.includes('invalid_token'))
          errors.push(
            `Users API: ${uRes.error} (ensure microservices/.env JWT_SECRET matches; restart all services).`,
          );
        else errors.push(`Users API: ${uRes.error}`);
        setUsers([]);
      } else {
        setUsers(uRes.users);
      }

      if (errors.length) setError(errors.join(' '));
    } finally {
      setLoading(false);
    }
  }, [accessToken, getAuthorizationHeader]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentSchool) return null;

  const schoolsBlocked = error?.includes('Schools API');
  const usersBlocked = error?.includes('Users API');

  const isPlatformMaster = currentUser?.role === 'platform_master';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">School directory</h1>
          <p className="mt-2 text-sm text-ink-600">
            Schools and members load from Cloud SQL via the schools-service and users-service APIs.
          </p>
        </div>
        {isPlatformMaster ?
          <Link to="/app/platform/tenants?create=1" className="shrink-0">
            <Button type="button" className="w-full px-6 py-3 text-base font-semibold shadow-card sm:w-auto">
              + Create new tenant
            </Button>
          </Link>
        : null}
      </div>

      {currentUser?.role === 'school_admin' && !isPlatformMaster && (
        <Card className="border-ink-100 bg-ink-50/80 py-4">
          <p className="text-sm text-ink-800">
            <strong>School admins</strong> manage this tenant only. Adding a{' '}
            <strong>new school (tenant)</strong> requires a{' '}
            <strong className="text-ink-900">Platform master</strong> account (
            <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">platform_master</code> in Postgres).
          </p>
          <p className="mt-2 text-xs text-ink-600">
            Ask your DB operator to run:{' '}
            <code className="rounded bg-white px-1 font-mono text-[11px]">
              {'UPDATE users SET role = \'platform_master\' WHERE email = \'your@email\';'}
            </code>{' '}
            then sign out and sign back in — you'll see <strong>Create tenant</strong> in the sidebar.
          </p>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">
          {error}
        </div>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-900">Schools</h2>
        <Card className="mt-4 overflow-x-auto">
          {loading ?
            <p className="text-sm text-ink-500">Loading…</p>
          : <>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Slug</th>
                    <th className="pb-3 font-medium">School ID</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => (
                    <tr key={s.schoolId} className="border-b border-ink-50">
                      <td className="py-3 pr-4 font-medium text-ink-900">{s.name}</td>
                      <td className="py-3 pr-4 text-ink-600">{s.slug}</td>
                      <td className="py-3 font-mono text-xs text-ink-500">{s.schoolId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && schools.length === 0 && !schoolsBlocked ?
                <p className="mt-4 text-sm text-ink-500">No rows in the schools table.</p>
              : null}
            </>
          }
        </Card>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-900">People in your school</h2>
        <Card className="mt-4 overflow-x-auto">
          {loading ?
            <p className="text-sm text-ink-500">Loading…</p>
          : <>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-b border-ink-50">
                      <td className="py-3 pr-4 font-medium text-ink-900">{u.userName}</td>
                      <td className="py-3 pr-4 text-ink-600">{u.email}</td>
                      <td className="py-3">
                        <Badge tone="accent">{roleLabelSafe(u.role)}</Badge>
                      </td>
                      <td className="py-3 text-ink-600">{u.active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && users.length === 0 && !usersBlocked ?
                <p className="mt-4 text-sm text-ink-500">No users returned by the directory API.</p>
              : null}
            </>
          }
        </Card>
      </section>
    </div>
  );
}
