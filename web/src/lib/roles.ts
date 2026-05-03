import type { UserRole } from '../domain/types';

const labels: Record<UserRole, string> = {
  school_admin: 'School admin',
  teacher: 'Teacher',
  teaching_assistant: 'Teaching assistant',
  student: 'Student',
};

export function roleLabel(role: UserRole): string {
  return labels[role];
}
