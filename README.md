# Learning platform (GCP)

This repository contains a **web** front end, an **auth** microservice, and SQL used with **Google Cloud SQL (PostgreSQL)** for sign-in.

## Database schema (PostgreSQL / Cloud SQL)

The auth service expects **`schools`** and **`users`** with the shapes below. The canonical scripts live in **`microservices/auth-service/sql/`** (especially `001_users_and_schools.sql`).

### 1. Apply the baseline schema

Run the following once per database (in **Cloud Shell**, **Cloud SQL Studio**, **psql** against your instance, or any PostgreSQL client). You can paste the contents of **`microservices/auth-service/sql/001_users_and_schools.sql`** or run:

```sql
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
      'platform_master',
      'school_admin',
      'teacher',
      'teaching_assistant',
      'student'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_users_school_id ON users (school_id);
```

If you deployed an older schema without **`platform_master`**, run **`microservices/auth-service/sql/002_platform_master_role.sql`** once to widen the `users.role` check constraint.

### 2. Roles

Use exactly these **`role`** values (they match the web app and auth service JWT payload):

| `role`               | Typical use                                    |
|----------------------|------------------------------------------------|
| `platform_master`    | Operators who create new tenants (school rows + first school admin via API). |
| `school_admin`       | Tenant / school admin                           |
| `teacher`            | Instructor            |
| `teaching_assistant` | TA                    |
| `student`            | Student               |

### 3. Create a school and a master admin user

**Option A — password hashed in Postgres (`pgcrypto`, no bcrypt string paste)**

Replace the placeholders (email, display name, school name/slug, and the password literal) before executing.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO schools (school_id, name, slug)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'Master School',
  'master'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (
  user_id,
  school_id,
  user_name,
  email,
  password_hash,
  role,
  active
)
VALUES (
  'b0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'Master Admin',
  'admin@yourdomain.com',
  crypt('YOUR_STRONG_PASSWORD_HERE', gen_salt('bf')),
  'platform_master',
  TRUE
)
ON CONFLICT (email) DO NOTHING;
```

**Option B — password hashed with Node (if `CREATE EXTENSION pgcrypto` is not allowed)**

From **`microservices/auth-service`**:

```bash
npx tsx src/scripts/hash-password.ts 'YOUR_STRONG_PASSWORD_HERE'
```

Copy the printed hash into:

```sql
INSERT INTO schools (school_id, name, slug)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'Master School',
  'master'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (
  user_id,
  school_id,
  user_name,
  email,
  password_hash,
  role,
  active
)
VALUES (
  'b0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'Master Admin',
  'admin@yourdomain.com',
  '$2a$12$...paste_full_bcrypt_hash...',
  'platform_master',
  TRUE
)
ON CONFLICT (email) DO NOTHING;
```

Sign-in from the SPA uses **`email` + plaintext password** → the auth service compares them to **`password_hash`**.

### 4. Connecting from your machine

- Use the Cloud SQL instance **public IP** as **`DATABASE_HOST`** / **`DATABASE_PORT`** in **`microservices/.env`**.
- In the Google Cloud Console, add your client’s **public IP** under **Authorized networks** for TCP access, or use the **Cloud SQL Auth Proxy** instead of opening the DB to broad internet access.

See **`microservices/.env.example`** for all database, JWT, and per-service port variables (copy to **`microservices/.env`**).

### 5. Verification

After configuring **`.env`**, from **`microservices/auth-service`**:

```bash
npm install
npm run db:test
```

## Microservices

All backend services share the **same Postgres database schema** (`schools`, `users`) and the **same `JWT_SECRET`**, so tokens from the auth service validate on the others.

### Centralized environment file

Put secrets in **one file** at **`microservices/.env`** (template: **`microservices/.env.example`**). Each service loads that file first (`config.ts` resolves `«service»/../.env` → `microservices/.env`). Keys include:

- **`AUTH_SERVICE_PORT`**, **`SCHOOLS_SERVICE_PORT`**, **`USERS_SERVICE_PORT`** — required in the shared file so every process gets its own port without clashing.
- **`JWT_SECRET`**, **`DATABASE_*`**, **`CORS_ORIGIN`**, plus **`JWT_EXPIRES_IN`** / **`BCRYPT_ROUNDS`** for auth.

If **`microservices/.env`** is missing, each service falls back to its legacy **`<service>/.env`**.

**Troubleshooting `invalid_token` on schools/users:** All three services must use the **exact same `JWT_SECRET`**. By default, **`dotenv` does not override variables already set in your shell**; this repo loads **`microservices/.env` with `override: true`** so the file wins. After changing **`JWT_SECRET`**, restart **auth-service**, **schools-service**, and **users-service**, then sign in again to get a fresh token.

| Service | Default port (env key) | Base path |
|---------|-------------------------|-----------|
| `auth-service` | `8080` (`AUTH_SERVICE_PORT`) | `/v1/auth`, `/health`, `/health/db` |
| `schools-service` | `8081` (`SCHOOLS_SERVICE_PORT`) | `/v1/schools`, `/health`, `/health/db` |
| `users-service` | `8082` (`USERS_SERVICE_PORT`) | `/v1/users`, `/health`, `/health/db` |

Run locally (three terminals):

```bash
cp microservices/.env.example microservices/.env
# edit microservices/.env — set JWT_SECRET, DATABASE_*, etc.

cd microservices/auth-service && npm install && npm run dev
cd microservices/schools-service && npm install && npm run dev
cd microservices/users-service && npm install && npm run dev
```

### `schools-service` API (JWT required)

Send header: **`Authorization: Bearer <access_token>`** (from **`POST /v1/auth/login`**).

- **`GET /v1/schools`** — all rows from the **`schools`** table (**`school_admin`** or **`platform_master`**, ordered by name).
- **`POST /v1/schools`** — **`platform_master` only**. Body: `{ "name", "slug", "initialAdmin": { "userName", "email" } }`. Inserts the school, calls **users-service** to create the tenant’s first **`school_admin`** with a random password, and returns **`{ school, schoolAdmin: { userId, email, userName, temporaryPassword } }`**. If bootstrap fails, the school row is rolled back. Requires **`USERS_SERVICE_INTERNAL_URL`** in **`microservices/.env`** on the schools-service process.
- **`GET /v1/schools/me`** — school row for the token’s `sid` (`school_id`).
- **`GET /v1/schools/:schoolId`** — same as above only when `:schoolId` matches the caller’s tenant (`403` otherwise).

Responses use JSON shape `{ school: { schoolId, name, slug, createdAt } }`.

### `users-service` API (JWT required)

- **`POST /v1/users/bootstrap-school-admin`** — **`platform_master` only** (usually called by **schools-service**, not the browser). Body: `{ schoolId, userName, email }`. Inserts a **`school_admin`** with a random bcrypt password and returns **`{ user, temporaryPassword }`** once.
- **`GET /v1/users/me`** — public profile fields for the current user (never includes `password_hash`).
- **`GET /v1/users`** — list users in the caller’s school. Allowed for **`school_admin`**, **`teacher`**, **`teaching_assistant`** only (`403` for **`student`**).
- **`GET /v1/users/:userId`** — profile if the subject is in the same school **and** the caller may see it (**self**, or **`school_admin` / `teacher` / `teaching_assistant`**). Otherwise **`403`** / **`404`**.

Responses use **`{ user: { userId, schoolId, userName, email, role, active, createdAt } }`** or **`{ users: [...] }`**.

Example (after login):

```bash
TOKEN='<paste accessToken>'

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/schools/me | jq .

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/v1/users/me | jq .

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/v1/users | jq .
```

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Vite + React SPA (sign-in → `auth-service` `/v1/auth/login`) |
| `microservices/auth-service/` | Login JWT + Postgres |
| `microservices/schools-service/` | School metadata reads (tenant scoped) |
| `microservices/users-service/` | User directory + profile reads (tenant scoped, role aware) |
| `microservices/auth-service/sql/` | SQL migrations / reference scripts |
