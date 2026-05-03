/** Roles allowed to call the tenant user directory listing. */

const DIRECTORY_ROLES = new Set(['school_admin', 'teacher', 'teaching_assistant']);

const STAFF_VIEW_ROLES = new Set(['school_admin', 'teacher', 'teaching_assistant']);

export function canListUserDirectory(role: string): boolean {
  return DIRECTORY_ROLES.has(role);
}

/** Read another user's profile within the same school (no password exposed). */

export function canViewUserProfile(actorRole: string, actorUserId: string, targetUserId: string): boolean {
  if (actorUserId === targetUserId) return true;
  return STAFF_VIEW_ROLES.has(actorRole);
}
