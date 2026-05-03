import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePlatform } from './state/PlatformContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './layouts/AppShell';
import { StudentBrowsePage } from './pages/student/StudentBrowsePage';
import { StudentFollowingPage } from './pages/student/StudentFollowingPage';
import { TeacherHomePage } from './pages/teacher/TeacherHomePage';
import { TeacherCourseMaterialsPage } from './pages/teacher/TeacherCourseMaterialsPage';
import { AdminSchoolPage } from './pages/admin/AdminSchoolPage';
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage';
import type { UserRole } from './domain/types';

function RedirectByRole({ role }: { role: UserRole }) {
  if (role === 'student') return <Navigate to="/app/student" replace />;
  if (role === 'teacher' || role === 'teaching_assistant')
    return <Navigate to="/app/teacher" replace />;
  return <Navigate to="/app/admin" replace />;
}

function AutoHomePage() {
  const { currentUser } = usePlatform();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <RedirectByRole role={currentUser.role} />;
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { currentUser } = usePlatform();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

function GateRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { currentUser } = usePlatform();
  if (!currentUser || !roles.includes(currentUser.role))
    return <Navigate to="/app/auto" replace />;
  return <>{children}</>;
}

function AppLayout() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="auto" replace />} />
        <Route path="auto" element={<AutoHomePage />} />

        <Route
          path="student"
          element={
            <GateRole roles={['student']}>
              <StudentBrowsePage />
            </GateRole>
          }
        />
        <Route
          path="student/following"
          element={
            <GateRole roles={['student']}>
              <StudentFollowingPage />
            </GateRole>
          }
        />

        <Route
          path="teacher"
          element={
            <GateRole roles={['teacher', 'teaching_assistant']}>
              <TeacherHomePage />
            </GateRole>
          }
        />
        <Route
          path="teacher/course/:courseId"
          element={
            <GateRole roles={['teacher', 'teaching_assistant']}>
              <TeacherCourseMaterialsPage />
            </GateRole>
          }
        />

        <Route
          path="admin"
          element={
            <GateRole roles={['school_admin']}>
              <AdminSchoolPage />
            </GateRole>
          }
        />
        <Route
          path="admin/courses"
          element={
            <GateRole roles={['school_admin']}>
              <AdminCoursesPage />
            </GateRole>
          }
        />

        <Route path="*" element={<Navigate to="/app/auto" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
