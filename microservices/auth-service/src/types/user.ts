/** Row shape returned from Cloud SQL queries (PostgreSQL snake_case columns). */

export interface UserAuthRow {
  user_id: string;
  school_id: string;
  user_name: string;
  email: string;
  role: string;
  password_hash: string;
  active: boolean;
}

export type UserPublic = {
  userId: string;
  schoolId: string;
  userName: string;
  email: string;
  role: string;
};
