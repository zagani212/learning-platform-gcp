-- PostgreSQL (Cloud SQL) — baseline schema aligned with auth-service expectations.
-- Run once per database (adjust names if needed).

CREATE TABLE IF NOT EXISTS schools (
  school_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools (school_id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_chk CHECK (
    role IN (
      'school_admin',
      'teacher',
      'teaching_assistant',
      'student'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_users_school_id ON users (school_id);

-- Example: bcrypt hash placeholder (replace via app or migration). Never store plain passwords.
