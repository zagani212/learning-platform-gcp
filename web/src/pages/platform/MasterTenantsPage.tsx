import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  createSchoolTenant,
  fetchSchoolsDirectory,
  getSchoolsApiBase,
  type SchoolDto,
} from '../../lib/schoolsApi';
import { usePlatform } from '../../state/PlatformContext';

export function MasterTenantsPage() {
  const formId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const successBannerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { accessToken, getAuthorizationHeader } = usePlatform();
  const [schools, setSchools] = useState<SchoolDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  /** Form panel hidden until user explicitly opens it — keeps a visible CTA above the fold. */
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [newTenant, setNewTenant] = useState<{
    schoolName: string;
    adminEmail: string;
    temporaryPassword: string;
  } | null>(null);

  const reloadSchools = useCallback(async () => {
    setListErr(null);
    setLoading(true);
    try {
      if (!accessToken || !getSchoolsApiBase()) {
        setListErr('Configure VITE_SCHOOLS_API_URL and sign in.');
        setSchools([]);
        return;
      }
      const h = getAuthorizationHeader();
      if (!h) return;
      const res = await fetchSchoolsDirectory(h);
      if (!res.ok) {
        setListErr(res.error);
        setSchools([]);
        return;
      }
      setSchools(res.schools);
    } finally {
      setLoading(false);
    }
  }, [accessToken, getAuthorizationHeader]);

  useEffect(() => {
    void reloadSchools();
  }, [reloadSchools]);

  useEffect(() => {
    const v = searchParams.get('create');
    if (v !== '1' && v !== 'true') return;
    setCreateErr(null);
    setNewTenant(null);
    setShowCreatePanel(true);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showCreatePanel) return;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [showCreatePanel]);

  useEffect(() => {
    if (!newTenant) return;
    successBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [newTenant]);

  const openCreatePanel = () => {
    setCreateErr(null);
    setNewTenant(null);
    setShowCreatePanel(true);
  };

  const cancelCreatePanel = () => {
    setShowCreatePanel(false);
    setCreateErr(null);
    setNewTenant(null);
  };

  const submitCreate = async () => {
    setCreateErr(null);
    setNewTenant(null);
    if (!name.trim() || !slug.trim() || !adminName.trim() || !adminEmail.trim()) {
      setCreateErr('Fill all fields.');
      return;
    }
    const slugNorm = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugNorm)) {
      setCreateErr('Slug must be lowercase letters, numbers, and hyphen only (no leading hyphen).');
      return;
    }
    const headers = getAuthorizationHeader();
    if (!headers) {
      setCreateErr('Not authenticated.');
      return;
    }

    setCreating(true);
    try {
      const res = await createSchoolTenant(headers, {
        name: name.trim(),
        slug: slugNorm,
        initialAdmin: { userName: adminName.trim(), email: adminEmail.trim() },
      });

      if (!res.ok) {
        setCreateErr(res.error);
        return;
      }
      setNewTenant({
        schoolName: res.data.school.name,
        adminEmail: res.data.schoolAdmin.email,
        temporaryPassword: res.data.schoolAdmin.temporaryPassword,
      });
      setName('');
      setSlug('');
      setAdminName('');
      setAdminEmail('');
      void reloadSchools();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">Tenants</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-600">
            Provision a new school and its first administrator. They sign in once with the
            temporary password, then change it when you onboard them.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            type="button"
            className="w-full px-6 py-3 text-base font-semibold shadow-card sm:w-auto"
            onClick={openCreatePanel}
          >
            + Create new tenant
          </Button>
          {showCreatePanel && (
            <Button variant="ghost" type="button" className="text-sm text-ink-500" onClick={cancelCreatePanel}>
              Hide form
            </Button>
          )}
        </div>
      </div>

      {!showCreatePanel && !loading && !listErr && schools.length === 0 && (
        <Card className="border border-dashed border-accent/40 bg-accent/5 py-14 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">No tenants yet</p>
          <p className="mt-2 px-6 text-sm text-ink-600">
            Schools in Cloud SQL appear here. Start by onboarding your first tenant.
          </p>
          <Button
            type="button"
            className="mt-6 px-8 py-3 text-base font-semibold"
            onClick={openCreatePanel}
          >
            Create new tenant
          </Button>
        </Card>
      )}

      {showCreatePanel && (
        <Card id="create-tenant" className="border-accent/30 shadow-card scroll-mt-24">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink-900">New tenant</h2>
            <Button variant="ghost" type="button" className="-mr-2 text-xs" onClick={cancelCreatePanel}>
              Close
            </Button>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Backend must have <code className="rounded bg-ink-100 px-1">USERS_SERVICE_INTERNAL_URL</code> in{' '}
            <code className="rounded bg-ink-100 px-1">microservices/.env</code>.
          </p>

          <form
            id={formId}
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCreate();
            }}
          >
            {createErr && (
              <p className="rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-800">{createErr}</p>
            )}
            {newTenant && (
              <div
                ref={successBannerRef}
                tabIndex={-1}
                className="rounded-lg bg-accent/10 px-4 py-3 text-sm text-ink-900 outline-none ring-2 ring-accent/25"
              >
                <p className="font-medium">Tenant ready: {newTenant.schoolName}</p>
                <p className="mt-2">
                  Share with the admin: <strong>{newTenant.adminEmail}</strong>
                </p>
                <p className="mt-2 font-mono text-xs tracking-wide text-ink-800 break-all">
                  {newTenant.temporaryPassword}
                </p>
                <p className="mt-3 text-xs text-ink-600">
                  Temporary password shown once — copy before leaving this screen.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  School name
                </span>
                <input
                  ref={firstFieldRef}
                  name="schoolName"
                  autoComplete="organization"
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  Slug (URL-safe)
                </span>
                <input
                  name="schoolSlug"
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. northstar-high"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  First admin — display name
                </span>
                <input
                  name="adminDisplayName"
                  autoComplete="name"
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  First admin — email
                </span>
                <input
                  type="email"
                  name="adminEmail"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={creating} className="min-h-11 px-8 text-base font-semibold">
                {creating ? 'Creating tenant…' : 'Create new tenant'}
              </Button>
              <Button variant="secondary" type="button" disabled={creating} onClick={cancelCreatePanel}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section id="schools-directory">
        <h2 className="font-display text-lg font-semibold text-ink-900">All schools</h2>
        <Card className="mt-4 overflow-x-auto">
          {loading ?
            <p className="text-sm text-ink-500">Loading…</p>
          : listErr ?
            <p className="text-sm text-ink-700">{listErr}</p>
          : <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase text-ink-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Slug</th>
                  <th className="pb-3 font-medium">School ID</th>
                  <th className="pb-3 pl-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.schoolId} className="border-b border-ink-50">
                    <td className="py-3 pr-4 font-medium text-ink-900">{s.name}</td>
                    <td className="py-3 pr-4 text-ink-600">{s.slug}</td>
                    <td className="py-3 font-mono text-xs text-ink-500">{s.schoolId}</td>
                    <td className="py-3 pl-2 text-right">
                      <Button variant="ghost" type="button" className="text-sm text-accent-dark" onClick={openCreatePanel}>
                        Another tenant…
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          {!loading && !listErr && schools.length === 0 ?
            showCreatePanel ?
              <p className="py-6 text-center text-sm text-ink-500">
                Submit the tenant form above to add your first school row.
              </p>
            : null
          : null}
        </Card>
      </section>

      {!loading && !listErr && schools.length > 0 && !showCreatePanel && (
        <div className="flex justify-center border-t border-ink-100 pt-8">
          <Button type="button" className="px-8 py-3 text-base font-semibold" onClick={openCreatePanel}>
            + Create another tenant
          </Button>
        </div>
      )}
    </div>
  );
}
