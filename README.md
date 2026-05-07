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
- For **media-service**: **`GCS_MEDIA_BUCKET`**, **`GCS_TENANT_PREFIX`**, **`MEDIA_SIGNED_URL_TTL_SECONDS`**, **`MEDIA_SERVICE_PORT`**.

If **`microservices/.env`** is missing, each service falls back to its legacy **`<service>/.env`**.

**Troubleshooting `invalid_token` on schools/users:** All three services must use the **exact same `JWT_SECRET`**. By default, **`dotenv` does not override variables already set in your shell**; this repo loads **`microservices/.env` with `override: true`** so the file wins. After changing **`JWT_SECRET`**, restart **auth-service**, **schools-service**, and **users-service**, then sign in again to get a fresh token.

| Service | Default port (env key) | Base path |
|---------|-------------------------|-----------|
| `auth-service` | `8080` (`AUTH_SERVICE_PORT`) | `/v1/auth`, `/health`, `/health/db` |
| `schools-service` | `8081` (`SCHOOLS_SERVICE_PORT`) | `/v1/schools`, `/health`, `/health/db` |
| `users-service` | `8082` (`USERS_SERVICE_PORT`) | `/v1/users`, `/health`, `/health/db` |
| `media-service` | `8083` (`MEDIA_SERVICE_PORT`) | `/v1/media`, `/health` |

Run locally (one terminal per service you need):

```bash
cp microservices/.env.example microservices/.env
# edit microservices/.env — set JWT_SECRET, DATABASE_*, etc.

cd microservices/auth-service && npm install && npm run dev
cd microservices/schools-service && npm install && npm run dev
cd microservices/users-service && npm install && npm run dev
# optional — Google Cloud Storage signed URLs (see below)
cd microservices/media-service && npm install && npm run dev
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
- **`GET /v1/users`** — list users in the caller’s school. Allowed for **`school_admin`**, **`platform_master`**, **`teacher`**, **`teaching_assistant`** (`403` for **`student`**).
- **`GET /v1/users/:userId`** — profile if the subject is in the same school **and** the caller may see it (**self**, or **`school_admin` / `teacher` / `teaching_assistant`**). Otherwise **`403`** / **`404`**.

Responses use **`{ user: { userId, schoolId, userName, email, role, active, createdAt } }`** or **`{ users: [...] }`**.

### `media-service` (JWT required) — tenant media on S3

Configure **`AWS_REGION`**, **`S3_MEDIA_BUCKET`** (and optionally **`S3_TENANT_PREFIX`**, default `tenants`) in **`microservices/.env`**. The process must run with AWS credentials (recommended: an instance role / task role) that can **presign** and **read/write objects** in that bucket.

**Signing locally:** set `AWS_PROFILE` (recommended) or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (and `AWS_REGION`). On AWS, attach an **IAM role** to the compute runtime and avoid static keys.

Object layout: **`{S3_TENANT_PREFIX}/{school_id}/media/{user_id}/{uuid}-{filename}`** — the JWT claim **`sid`** must match **`school_id`** for upload and read.

- **`POST /v1/media/signed-upload`** — **`teacher`** or **`teaching_assistant`** only. Body: `{ "fileName", "contentType" }` with an allowed MIME type: common **images** (JPEG, PNG, GIF, WebP), **video** (MP4, WebM, QuickTime), **PDF**, **audio** (MPEG, WAV, WebM, MP4), and **Word/PowerPoint** (legacy and Open XML). Returns **`{ uploadUrl, objectKey, method: "PUT", headers: { "Content-Type": … }, expiresAt }`**. The browser should **`PUT`** the raw file bytes to **`uploadUrl`** with exactly that **`Content-Type`** header.
- **`POST /v1/media/signed-read`** — any signed-in role in the same tenant (**`student`**, **`teacher`**, **`teaching_assistant`**, **`school_admin`**, **`platform_master`**). Body: `{ "objectKey" }` must start with **`{S3_TENANT_PREFIX}/{caller sid}/`**. Returns **`{ readUrl, expiresAt }`**.

**Bucket CORS (browser uploads):** allow **`PUT`** from your SPA origin (for example `http://localhost:5173`) and the response headers your client needs. (For S3, configure CORS on the bucket similarly: allow `PUT/GET/HEAD`, allow `Content-Type` header, and expose `ETag` if needed.)

#### S3 bucket CORS (example)

In the S3 bucket CORS configuration (AWS Console → S3 → Bucket → Permissions → CORS), allow your SPA origin(s) and the methods used by presigned URLs:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.example"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

#### IAM permissions for `media-service` (EC2 instance role)

Attach an IAM role (instance profile) to the EC2 instance running the containers. The role should be allowed to access only your media bucket (and optionally only the prefix you use).

Example policy (bucket + objects):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowTenantMediaBucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-s3-bucket-name"
    },
    {
      "Sid": "AllowTenantMediaObjectRW",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::your-s3-bucket-name/*"
    }
  ]
}
```

```json
[
  {
    "origin": ["http://localhost:5173"],
    "method": ["PUT", "GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

The web app reads **`VITE_MEDIA_API_URL`** (see **`web/.env.example`**). Teacher **file** uploads require it; **links** still work without it.

### Example `curl` calls (after login)

```bash
TOKEN='<paste accessToken>'

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/schools/me | jq .

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/v1/users/me | jq .

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/v1/users | jq .

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fileName":"clip.mp4","contentType":"video/mp4"}' \
  http://localhost:8083/v1/media/signed-upload | jq .
```

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Vite + React SPA (sign-in → `auth-service` `/v1/auth/login`) |
| `microservices/auth-service/` | Login JWT + Postgres |
| `microservices/schools-service/` | School metadata reads (tenant scoped) |
| `microservices/users-service/` | User directory + profile reads (tenant scoped, role aware) |
| `microservices/media-service/` | Signed upload/read URLs for tenant-scoped objects in GCS |
| `microservices/auth-service/sql/` | SQL migrations / reference scripts |

## AWS / EC2 deployment checklist (quick)

1) **Prepare AWS resources**
- **RDS Postgres** reachable from EC2 security group on `5432`.
- **S3 bucket** created (CORS configured as above).
- **EC2 IAM role** attached (permissions as above).

2) **Configure env**
- Copy `microservices/.env.aws.example` → `microservices/.env` on the EC2 box and set:
  - `DATABASE_HOST` to the RDS endpoint
  - `DATABASE_SSL=true`
  - `JWT_SECRET` to a strong secret (≥ 16 chars)
  - `AWS_REGION`, `S3_MEDIA_BUCKET`
  - `CORS_ORIGIN=https://your-domain.example`
- Copy `web/.env.aws.example` → `.env` (or export the vars) for the frontend build:
  - `VITE_AUTH_API_URL`, `VITE_SCHOOLS_API_URL`, `VITE_USERS_API_URL`, `VITE_MEDIA_API_URL`

3) **Start the stack**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

4) **Verify health**

```bash
curl -s http://<EC2_PUBLIC_IP>/api/auth/health | jq .
curl -s http://<EC2_PUBLIC_IP>/api/schools/health | jq .
curl -s http://<EC2_PUBLIC_IP>/api/users/health | jq .
curl -s http://<EC2_PUBLIC_IP>/api/media/health | jq .
```

5) **Verify DB connectivity**

```bash
curl -s http://<EC2_PUBLIC_IP>/api/auth/health/db | jq .
curl -s http://<EC2_PUBLIC_IP>/api/schools/health/db | jq .
curl -s http://<EC2_PUBLIC_IP>/api/users/health/db | jq .
```

6) **Verify media (presign + browser PUT)**
- Login in the SPA, request `POST /api/media/v1/media/signed-upload` (or via UI).
- Browser `PUT` to the returned `uploadUrl` must succeed (if it fails, check S3 CORS + correct `Content-Type`).

