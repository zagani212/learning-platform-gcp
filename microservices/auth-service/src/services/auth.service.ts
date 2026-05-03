import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import type { UserAuthRow } from '../types/user.js';

const SELECT_USER_SQL = `
  SELECT
    u.user_id,
    u.school_id,
    u.user_name,
    u.email,
    u.role,
    u.password_hash,
    u.active
  FROM users u
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
  LIMIT 1
`;

function toPublic(row: UserAuthRow): {
  userId: string;
  schoolId: string;
  userName: string;
  email: string;
  role: string;
} {
  return {
    userId: row.user_id,
    schoolId: row.school_id,
    userName: row.user_name,
    email: row.email,
    role: row.role,
  };
}

export class AuthService {
  async verifyEmailPassword(email: string, password: string) {
    const { rows } = await pool.query<UserAuthRow>(SELECT_USER_SQL, [email]);
    const row = rows[0];
    if (!row) return { ok: false as const, reason: 'invalid_credentials' };

    if (!row.active) return { ok: false as const, reason: 'account_disabled' };

    const matches = await bcrypt.compare(password, row.password_hash);
    if (!matches) return { ok: false as const, reason: 'invalid_credentials' };

    const user = toPublic(row);
    const expiresInSeconds = jwtExpiresInSeconds(config.JWT_EXPIRES_IN);

    const accessToken = jwt.sign(
      {
        typ: 'access',
        uid: user.userId,
        sid: user.schoolId,
        role: user.role,
        name: user.userName,
      },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: config.JWT_EXPIRES_IN,
        subject: user.userId,
        jwtid: randomUUID(),
      },
    );

    return {
      ok: true as const,
      accessToken,
      expiresInSeconds,
      tokenType: 'Bearer' as const,
      user,
    };
  }
}

/** Parses common forms like `15m`, `7d`, or raw seconds-as-string. Fallback 900s. */
function jwtExpiresInSeconds(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const num = /^(\d+)$/.exec(trimmed);
  if (num) return Number.parseInt(num[1]!, 10);

  const m = /^(\d+)(ms|s|m|h|d)$/.exec(trimmed);
  if (!m) return 900;
  const n = Number.parseInt(m[1]!, 10);
  const unit = m[2];
  switch (unit) {
    case 'ms':
      return Math.max(1, Math.floor(n / 1000));
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return 900;
  }
}
