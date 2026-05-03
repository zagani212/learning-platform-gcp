export type UserRole =
  | 'platform_master'
  | 'school_admin'
  | 'teacher'
  | 'student'
  | 'teaching_assistant';

export interface School {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  schoolId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export type AssetKind = 'pdf' | 'video' | 'document' | 'link' | 'audio';

export interface CourseAsset {
  id: string;
  courseId: string;
  kind: AssetKind;
  title: string;
  /** object URL for uploaded files, or href for links */
  url: string;
  /** original file name when applicable */
  fileName?: string;
  createdAt: string;
}

export interface Course {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: string;
}

export interface PlatformSnapshot {
  schools: School[];
  users: User[];
  courses: Course[];
  assets: CourseAsset[];
  enrollments: Enrollment[];
}
