import type { Course, CourseAsset, Enrollment, PlatformSnapshot, School, User } from './types';

export function emptyPlatformSnapshot(): PlatformSnapshot {
  return {
    schools: [],
    users: [],
    courses: [],
    assets: [],
    enrollments: [],
  };
}

const now = () => new Date().toISOString();

export function buildSeedSnapshot(): PlatformSnapshot {
  const schools: School[] = [
    { id: 'sch-riverside', name: 'Riverside Academy', slug: 'riverside' },
    { id: 'sch-northstar', name: 'Northstar High', slug: 'northstar' },
  ];

  const users: User[] = [
    {
      id: 'u-ra-admin',
      schoolId: 'sch-riverside',
      email: 'admin@riverside.edu',
      displayName: 'Jordan Lee',
      role: 'school_admin',
    },
    {
      id: 'u-ra-t1',
      schoolId: 'sch-riverside',
      email: 'm.chen@riverside.edu',
      displayName: 'Maya Chen',
      role: 'teacher',
    },
    {
      id: 'u-ra-s1',
      schoolId: 'sch-riverside',
      email: 'alex@riverside.edu',
      displayName: 'Alex Rivera',
      role: 'student',
    },
    {
      id: 'u-ra-ta',
      schoolId: 'sch-riverside',
      email: 'sam@riverside.edu',
      displayName: 'Sam Okonkwo',
      role: 'teaching_assistant',
    },
    {
      id: 'u-ns-admin',
      schoolId: 'sch-northstar',
      email: 'admin@northstar.edu',
      displayName: 'Priya Nair',
      role: 'school_admin',
    },
    {
      id: 'u-ns-t1',
      schoolId: 'sch-northstar',
      email: 'd.brown@northstar.edu',
      displayName: 'Dana Brown',
      role: 'teacher',
    },
    {
      id: 'u-ns-s1',
      schoolId: 'sch-northstar',
      email: 'casey@northstar.edu',
      displayName: 'Casey Kim',
      role: 'student',
    },
  ];

  const courses: Course[] = [
    {
      id: 'c-ra-1',
      schoolId: 'sch-riverside',
      title: 'Introduction to Physics',
      description: 'Mechanics, energy, and waves with applied labs.',
      teacherId: 'u-ra-t1',
      teacherName: 'Maya Chen',
      createdAt: now(),
    },
    {
      id: 'c-ra-2',
      schoolId: 'sch-riverside',
      title: 'Creative Writing Workshop',
      description: 'Short fiction, peer review, and revision cycles.',
      teacherId: 'u-ra-t1',
      teacherName: 'Maya Chen',
      createdAt: now(),
    },
    {
      id: 'c-ns-1',
      schoolId: 'sch-northstar',
      title: 'Data Literacy',
      description: 'Charts, statistics, and critical reading of data stories.',
      teacherId: 'u-ns-t1',
      teacherName: 'Dana Brown',
      createdAt: now(),
    },
  ];

  const assets: CourseAsset[] = [
    {
      id: 'a-ra-1',
      courseId: 'c-ra-1',
      kind: 'link',
      title: 'Course syllabus (sample link)',
      url: 'https://example.com/syllabus',
      createdAt: now(),
    },
  ];

  const enrollments: Enrollment[] = [
    {
      id: 'e-1',
      courseId: 'c-ra-1',
      studentId: 'u-ra-s1',
      enrolledAt: now(),
    },
  ];

  return { schools, users, courses, assets, enrollments };
}
