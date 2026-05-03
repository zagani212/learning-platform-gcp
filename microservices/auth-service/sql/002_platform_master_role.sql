-- PostgreSQL: add platform-level operator who can onboard new tenants.
-- Run once after 001_users_and_schools.sql

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_chk;

ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (
  role IN (
    'platform_master',
    'school_admin',
    'teacher',
    'teaching_assistant',
    'student'
  )
);
