import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { randomTempPassword } from '../lib/randomPassword.js';
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

export class BootstrapService {
  /** Creates first `school_admin` for a new school. Returns plaintext password once. */
  async createSchoolAdminUser(input: {
    schoolId: string;
    userName: string;
    email: string;
  }): Promise<
    | { ok: true; user: UserDto; temporaryPassword: string }
    | { ok: false; reason: 'school_not_found' | 'duplicate_email' | 'db_error' }
  > {
    const email = input.email.trim();
    const userName = input.userName.trim();
    const rounds = Math.min(16, Math.max(4, config.BCRYPT_ROUNDS));

    const schoolCheck = await pool.query<{ one: number }>(
      `SELECT 1 AS one FROM schools WHERE school_id = $1 LIMIT 1`,
      [input.schoolId],
    );
    if (!schoolCheck.rows[0]) {
      return { ok: false, reason: 'school_not_found' };
    }

    const temp = randomTempPassword();
    const passwordHash = await bcrypt.hash(temp, rounds);
    const userId = randomUUID();

    try {
      const { rows } = await pool.query<UserRow>(
        `
        INSERT INTO users (user_id, school_id, user_name, email, password_hash, role, active)
        VALUES ($1::uuid, $2::uuid, $3, LOWER(TRIM($4)), $5, 'school_admin', TRUE)
        RETURNING user_id, school_id, user_name, email, role, active, created_at
        `,
        [userId, input.schoolId, userName, email, passwordHash],
      );
      const row = rows[0];
      if (!row) return { ok: false, reason: 'db_error' };
      return { ok: true, user: toDto(row), temporaryPassword: temp };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === '23505') {
        return { ok: false, reason: 'duplicate_email' };
      }
      console.error(e);
      return { ok: false, reason: 'db_error' };
    }
  }
}
