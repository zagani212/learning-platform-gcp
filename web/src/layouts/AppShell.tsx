import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { roleLabel } from '../lib/roles';
import { usePlatform } from '../state/PlatformContext';
import type { UserRole } from '../domain/types';

function navForRole(role: UserRole): { to: string; label: string }[] {
  switch (role) {
    case 'platform_master':
      return [
        { to: '/app/platform/tenants', label: 'Create tenant' },
        { to: '/app/admin', label: 'School directory' },
        { to: '/app/admin/courses', label: 'All courses' },
      ];
    case 'student':
      return [
        { to: '/app/student', label: 'Courses' },
        { to: '/app/student/following', label: 'Following' },
      ];
    case 'teacher':
    case 'teaching_assistant':
      return [{ to: '/app/teacher', label: 'My courses' }];
    case 'school_admin':
      return [
        { to: '/app/admin', label: 'School' },
        { to: '/app/admin/courses', label: 'All courses' },
      ];
    default:
      return [];
  }
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'
  }`;

export function AppShell() {
  const { currentUser, currentSchool, logout } = usePlatform();
  const navigate = useNavigate();

  if (!currentUser || !currentSchool) return null;

  const items = navForRole(currentUser.role);

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 flex-col border-r border-ink-100 bg-white md:flex">
        <div className="border-b border-ink-100 px-5 py-6">
          <p className="font-display text-lg font-semibold text-ink-900">School Hub</p>
          <p className="mt-1 text-xs text-ink-500">{currentSchool.name}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-100 p-4">
          <p className="text-sm font-medium text-ink-900">{currentUser.displayName}</p>
          <p className="text-xs text-ink-500">{currentUser.email}</p>
          <div className="mt-2">
            <Badge tone="accent">{roleLabel(currentUser.role)}</Badge>
          </div>
          <Button
            variant="ghost"
            className="mt-4 w-full justify-start px-2 text-left text-ink-600"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 md:hidden">
          <div>
            <p className="font-display text-sm font-semibold">School Hub</p>
            <p className="text-xs text-ink-500">{currentSchool.name}</p>
          </div>
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Out
          </Button>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-ink-100 bg-white px-3 py-2 md:hidden">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
