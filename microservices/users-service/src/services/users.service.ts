import { pool } from '../db/pool.js';
import type { UserDto, UserRow } from '../types/user.js';

function toDto(row: UserRow): UserDto {
  return {
    userId: row.user_id,
    schoolId: row.school_id,
    userName: row.user_name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

const USER_PUBLIC_FIELDS = `
  user_id,
  school_id,
  user_name,
  email,
  role,
  active,
  created_at
`;

export class UsersService {
  async getUserInSchool(userId: string, schoolId: string): Promise<UserDto | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE user_id = $1 AND school_id = $2 LIMIT 1`,
      [userId, schoolId],
    );
    const row = rows[0];
    return row ? toDto(row) : null;
  }

  async listUsersBySchool(schoolId: string): Promise<UserDto[]> {
    const { rows } = await pool.query<UserRow>(
      `
      SELECT ${USER_PUBLIC_FIELDS}
      FROM users
      WHERE school_id = $1
      ORDER BY user_name ASC NULLS LAST, email ASC
      `,
      [schoolId],
    );
    return rows.map(toDto);
  }
}
