import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AssetKind,
  Course,
  CourseAsset,
  Enrollment,
  PlatformSnapshot,
  School,
  User,
} from '../domain/types';
import { emptyPlatformSnapshot } from '../domain/seed';
import { parseUserRole, requestLogin } from '../lib/authApi';

const STORAGE_KEY = 'learning-platform.snapshot.v1';
const AUTH_STORAGE_KEY = 'learning-platform.auth.v1';

interface AuthSession {
  accessToken: string;
  user: User;
}

function loadSnapshot(): PlatformSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformSnapshot;
      if (
        parsed &&
        Array.isArray(parsed.schools) &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.courses) &&
        Array.isArray(parsed.assets) &&
        Array.isArray(parsed.enrollments)
      ) {
        return {
          ...parsed,
          assets: parsed.assets.filter(
            (a) =>
              a.kind === 'link' ||
              Boolean(a.gcsObjectKey) ||
              (typeof a.url === 'string' && a.url.length > 0 && !a.url.startsWith('blob:')),
          ),
        };
      }
    }
  } catch {
    /* ignore */
  }
  const empty = emptyPlatformSnapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  return empty;
}

function saveSnapshot(s: PlatformSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      !parsed?.accessToken ||
      !parsed?.user?.id ||
      !parsed?.user?.schoolId ||
      !parsed?.user?.email ||
      !parsed?.user?.role
    ) {
      return null;
    }
    const role = parseUserRole(parsed.user.role);
    if (!role) return null;
    return {
      accessToken: parsed.accessToken,
      user: { ...parsed.user, role },
    };
  } catch {
    return null;
  }
}

function saveAuthSession(session: AuthSession | null) {
  if (session) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

function ensureSchoolSlug(schoolId: string): string {
  const compact = schoolId.replace(/-/g, '');
  return `school-${compact.slice(0, 16)}`;
}

export interface LoginFailure {
  ok: false;
  error: string;
  status?: number;
}

export interface LoginSuccess {
  ok: true;
}

export interface PlatformContextValue {
  snapshot: PlatformSnapshot;
  /** JWT from auth-service (use for upcoming backend calls). */
  accessToken: string | null;
  currentUser: User | null;
  currentSchool: School | null;
  loginWithCredentials: (email: string, password: string) => Promise<LoginSuccess | LoginFailure>;
  logout: () => void;
  resetLocalData: () => void;
  getAuthorizationHeader: () => Record<string, string> | undefined;
  schools: School[];
  usersInSchool: (schoolId: string) => User[];
  coursesForSchool: (schoolId: string) => Course[];
  coursesICanTeach: Course[];
  coursesForStudent: Course[];
  myEnrollments: Enrollment[];
  enroll: (courseId: string) => void;
  unenroll: (courseId: string) => void;
  createCourse: (input: { title: string; description: string }) => void;
  /** After a successful PUT to the signed upload URL, persist metadata in the local snapshot. */
  registerCloudAsset: (
    courseId: string,
    input: { objectKey: string; title: string; fileName: string; kind: AssetKind },
  ) => void;
  addLinkAsset: (courseId: string, title: string, url: string) => void;
  assetsForCourse: (courseId: string) => CourseAsset[];
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(() => loadSnapshot());
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession());

  const currentUser = authSession?.user ?? null;

  const currentSchool = useMemo(
    () => snapshot.schools.find((s) => s.id === currentUser?.schoolId) ?? null,
    [snapshot.schools, currentUser?.schoolId],
  );

  const update = useCallback((fn: (prev: PlatformSnapshot) => PlatformSnapshot) => {
    setSnapshot((prev) => {
      const next = fn(prev);
      saveSnapshot(next);
      return next;
    });
  }, []);

  const loginWithCredentials = useCallback(
    async (email: string, password: string): Promise<LoginSuccess | LoginFailure> => {
      const result = await requestLogin(email, password);

      if (!result.ok) {
        return {
          ok: false,
          error: result.error,
          status: result.status,
        };
      }

      const role = parseUserRole(result.body.user.role);
      if (!role) {
        return { ok: false, error: 'unknown_role', status: result.status };
      }

      const user: User = {
        id: result.body.user.userId,
        schoolId: result.body.user.schoolId,
        email: result.body.user.email,
        displayName: result.body.user.userName,
        role,
      };

      const session: AuthSession = {
        accessToken: result.body.accessToken,
        user,
      };

      setAuthSession(session);
      saveAuthSession(session);

      update((prev) => {
        if (prev.schools.some((s) => s.id === user.schoolId)) return prev;
        const school: School = {
          id: user.schoolId,
          name: 'Your school',
          slug: ensureSchoolSlug(user.schoolId),
        };
        return { ...prev, schools: [...prev.schools, school] };
      });

      return { ok: true };
    },
    [update],
  );

  const logout = useCallback(() => {
    setAuthSession(null);
    saveAuthSession(null);
  }, []);

  const resetLocalData = useCallback(() => {
    const empty = emptyPlatformSnapshot();
    setSnapshot(empty);
    saveSnapshot(empty);
    setAuthSession(null);
    saveAuthSession(null);
  }, []);

  const getAuthorizationHeader = useCallback((): Record<string, string> | undefined => {
    if (!authSession?.accessToken) return undefined;
    return { Authorization: `Bearer ${authSession.accessToken}` };
  }, [authSession?.accessToken]);

  const usersInSchool = useCallback(
    (schoolId: string) => snapshot.users.filter((u) => u.schoolId === schoolId),
    [snapshot.users],
  );

  const coursesForSchool = useCallback(
    (schoolId: string) => snapshot.courses.filter((c) => c.schoolId === schoolId),
    [snapshot.courses],
  );

  const coursesICanTeach = useMemo(() => {
    if (!currentUser || !currentSchool) return [];
    if (currentUser.role !== 'teacher' && currentUser.role !== 'teaching_assistant') {
      return [];
    }
    return snapshot.courses.filter(
      (c) => c.schoolId === currentSchool.id && c.teacherId === currentUser.id,
    );
  }, [currentUser, currentSchool, snapshot.courses]);

  const coursesForStudent = useMemo(() => {
    if (!currentUser || !currentSchool || currentUser.role !== 'student') return [];
    return snapshot.courses.filter((c) => c.schoolId === currentSchool.id);
  }, [currentUser, currentSchool, snapshot.courses]);

  const myEnrollments = useMemo(() => {
    if (!currentUser) return [];
    return snapshot.enrollments.filter((e) => e.studentId === currentUser.id);
  }, [currentUser, snapshot.enrollments]);

  const enroll = useCallback(
    (courseId: string) => {
      if (!currentUser || currentUser.role !== 'student') return;
      const course = snapshot.courses.find((c) => c.id === courseId);
      if (!course || course.schoolId !== currentUser.schoolId) return;
      const exists = snapshot.enrollments.some(
        (e) => e.courseId === courseId && e.studentId === currentUser.id,
      );
      if (exists) return;
      const id = crypto.randomUUID();
      update((prev) => ({
        ...prev,
        enrollments: [
          ...prev.enrollments,
          {
            id,
            courseId,
            studentId: currentUser.id,
            enrolledAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [currentUser, snapshot.courses, snapshot.enrollments, update],
  );

  const unenroll = useCallback(
    (courseId: string) => {
      if (!currentUser) return;
      update((prev) => ({
        ...prev,
        enrollments: prev.enrollments.filter(
          (e) => !(e.courseId === courseId && e.studentId === currentUser.id),
        ),
      }));
    },
    [currentUser, update],
  );

  const createCourse = useCallback(
    (input: { title: string; description: string }) => {
      if (!currentUser || !currentSchool) return;
      if (currentUser.role !== 'teacher' && currentUser.role !== 'teaching_assistant') return;
      const title = input.title.trim();
      if (!title) return;
      const id = crypto.randomUUID();
      update((prev) => ({
        ...prev,
        courses: [
          ...prev.courses,
          {
            id,
            schoolId: currentSchool.id,
            title,
            description: input.description.trim(),
            teacherId: currentUser.id,
            teacherName: currentUser.displayName,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [currentUser, currentSchool, update],
  );

  const registerCloudAsset = useCallback(
    (
      courseId: string,
      input: { objectKey: string; title: string; fileName: string; kind: AssetKind },
    ) => {
      if (!currentUser || !currentSchool) return;
      const course = snapshot.courses.find((c) => c.id === courseId);
      if (!course || course.schoolId !== currentSchool.id) return;
      const canEdit =
        currentUser.role === 'school_admin' ||
        (currentUser.role === 'teacher' && course.teacherId === currentUser.id) ||
        currentUser.role === 'teaching_assistant';
      if (!canEdit) return;
      const asset: CourseAsset = {
        id: crypto.randomUUID(),
        courseId,
        kind: input.kind,
        title: input.title,
        url: '',
        gcsObjectKey: input.objectKey,
        fileName: input.fileName,
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({ ...prev, assets: [...prev.assets, asset] }));
    },
    [currentUser, currentSchool, snapshot.courses, update],
  );

  const addLinkAsset = useCallback(
    (courseId: string, title: string, url: string) => {
      if (!currentUser || !currentSchool) return;
      const course = snapshot.courses.find((c) => c.id === courseId);
      if (!course || course.schoolId !== currentSchool.id) return;
      const canEdit =
        currentUser.role === 'school_admin' ||
        (currentUser.role === 'teacher' && course.teacherId === currentUser.id) ||
        currentUser.role === 'teaching_assistant';
      if (!canEdit) return;
      const t = title.trim();
      const u = url.trim();
      if (!t || !u) return;
      const id = crypto.randomUUID();
      const asset: CourseAsset = {
        id,
        courseId,
        kind: 'link',
        title: t,
        url: u,
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({ ...prev, assets: [...prev.assets, asset] }));
    },
    [currentUser, currentSchool, snapshot.courses, update],
  );

  const assetsForCourse = useCallback(
    (courseId: string) => snapshot.assets.filter((a) => a.courseId === courseId),
    [snapshot.assets],
  );

  const value = useMemo<PlatformContextValue>(
    () => ({
      snapshot,
      accessToken: authSession?.accessToken ?? null,
      currentUser,
      currentSchool,
      loginWithCredentials,
      logout,
      resetLocalData,
      getAuthorizationHeader,
      schools: snapshot.schools,
      usersInSchool,
      coursesForSchool,
      coursesICanTeach,
      coursesForStudent,
      myEnrollments,
      enroll,
      unenroll,
      createCourse,
      registerCloudAsset,
      addLinkAsset,
      assetsForCourse,
    }),
    [
      snapshot,
      authSession?.accessToken,
      currentUser,
      currentSchool,
      loginWithCredentials,
      logout,
      resetLocalData,
      getAuthorizationHeader,
      usersInSchool,
      coursesForSchool,
      coursesICanTeach,
      coursesForStudent,
      myEnrollments,
      enroll,
      unenroll,
      createCourse,
      registerCloudAsset,
      addLinkAsset,
      assetsForCourse,
    ],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
