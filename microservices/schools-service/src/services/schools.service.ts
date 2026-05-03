import { pool } from '../db/pool.js';
import type { SchoolDto, SchoolRow } from '../types/school.js';

function toDto(row: SchoolRow): SchoolDto {
  return {
    schoolId: row.school_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export class SchoolsService {
  async listSchools(): Promise<SchoolDto[]> {
    const { rows } = await pool.query<SchoolRow>(
      `SELECT school_id, name, slug, created_at FROM schools ORDER BY name ASC`,
    );
    return rows.map(toDto);
  }

  async getSchoolById(schoolId: string): Promise<SchoolDto | null> {
    const { rows } = await pool.query<SchoolRow>(
      `SELECT school_id, name, slug, created_at FROM schools WHERE school_id = $1 LIMIT 1`,
      [schoolId],
    );
    const row = rows[0];
    return row ? toDto(row) : null;
  }
}
