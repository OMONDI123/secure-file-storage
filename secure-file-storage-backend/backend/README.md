# Secure File Storage — Backend

A REST API for the Secure File Storage assignment, built with **Node.js, Express, TypeScript, and PostgreSQL**.

Authenticated users can register, log in, upload files (100MB+ supported), list their own files, toggle each file between public and private, and delete files. Public files get a random, unguessable share token that anyone can use to view and download the file without an account. Private files are only accessible to their owner.

## Tech stack

- Node.js + Express + TypeScript
- PostgreSQL (via `pg`, raw SQL — no ORM, so the schema and queries are easy to audit)
- JWT access tokens (short-lived, sent in the `Authorization` header) + JWT refresh tokens (long-lived, stored in an `httpOnly` cookie and rotated on every use)
- `multer` for streaming multipart uploads directly to disk (files never sit fully in memory)
- `bcryptjs`, `helmet`, `express-rate-limit`, `zod` for security and validation

## Why this design

- **Refresh tokens live in an `httpOnly` cookie**, not `localStorage`, so they can't be read by JavaScript (mitigates XSS token theft). Access tokens live in memory on the frontend and are short-lived (15 minutes by default).
- **File uploads are validated by an allowlist**, not a denylist, of extensions and MIME types, per the OWASP File Upload Cheat Sheet — denylists are trivially bypassed. Double extensions (e.g. `invoice.php.pdf`) are rejected. The original filename is never used to build the on-disk path; every stored file gets a fresh UUID name, which prevents path traversal and overwrite attacks.
- **Authorization is checked at the data layer**, not just the route layer: every file read/write re-verifies `owner_id` against the requesting user before touching the row, so there's no way to reach another user's private file by guessing an ID.
- **Downloads support HTTP Range requests**, so large files can be streamed, resumed, and scrubbed (e.g. video) rather than loaded in one shot.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (a local install, or use the included Docker Compose setup)

## Option A — Run with Docker Compose (recommended, fastest)

This starts both PostgreSQL and the API together.

```bash
cd backend
cp .env.example .env      # defaults work as-is for Docker
docker compose up --build
```

The API will be available at `http://localhost:4000`. Run migrations once the containers are up:

```bash
docker compose exec api node dist/db/migrate.js
```

## Option B — Run locally against your own PostgreSQL

1. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

2. **Create a database and role**

   The included `.env.example` is pre-configured for a role named `adempiere`:

   ```sql
   CREATE ROLE adempiere WITH LOGIN PASSWORD 'bunde123';
   ALTER ROLE adempiere CREATEDB;
   CREATE DATABASE secure_file_storage OWNER adempiere;
   ```

   (You can use any role/database name you like — just make sure `DATABASE_URL` in the next step matches.)

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   `.env` already points at `postgresql://adempiere:bunde1234@localhost:5432/secure_file_storage`. If you used different credentials in step 2, update `DATABASE_URL` to match. Also replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with your own long random strings (e.g. `openssl rand -hex 32`).

4. **Run migrations**

   ```bash
   npm run migrate
   ```

5. **Start the server**

   ```bash
   npm run dev       # development, auto-reloads on file changes
   # or
   npm run build && npm start   # production build
   ```

The API will be available at `http://localhost:4000`. Check `GET /health` to confirm it's up.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the API listens on | `4000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CLIENT_ORIGIN` | The frontend's origin, used for CORS and building share links | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | — |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `STORAGE_DIR` | Where uploaded files are stored on disk | `./storage` |
| `MAX_FILE_SIZE_MB` | Maximum upload size | `120` |

## Connecting the frontend

The frontend (in `../frontend`) talks to this API over HTTP. Two things need to line up:

1. The frontend's `VITE_API_BASE_URL` (in `frontend/.env`) must point at this API — `http://localhost:4000` by default.
2. This API's `CLIENT_ORIGIN` (in `backend/.env`) must match the frontend's actual origin — `http://localhost:5173` by default (Vite's dev server port) — so CORS and cookies work correctly, and so public share links (`shareUrl`) point at the right place.

If you change either port, update the other side's env var to match.

## API overview

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in |
| POST | `/api/auth/refresh` | cookie | Exchange the refresh cookie for a new access token |
| POST | `/api/auth/logout` | cookie | Revoke the refresh token |
| GET | `/api/auth/me` | Bearer | Get the current user |
| POST | `/api/files` | Bearer | Upload a file (`multipart/form-data`, field `file`, optional `isPublic`) |
| GET | `/api/files` | Bearer | List your files |
| GET | `/api/files/:id` | Bearer | Get one file's metadata |
| PATCH | `/api/files/:id/visibility` | Bearer | Set `{ "isPublic": true/false }` |
| DELETE | `/api/files/:id` | Bearer | Delete a file |
| GET | `/api/files/:id/download` | Bearer | Download a file you own (any visibility) |
| GET | `/api/files/public/:token` | — | Get metadata for a public file by its share token |
| GET | `/api/files/public/:token/download` | — | Download a public file by its share token, no auth required |

A file's JSON representation includes:
- `downloadUrl` — requires the owner's Bearer token; works for public or private files
- `publicDownloadUrl` — no auth required; only set while the file is public
- `shareUrl` — the frontend page (`/share/:token`) a human would open in a browser

## Testing it manually with curl

```bash
# Register
curl -c cookies.txt -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Passw0rd123","name":"Your Name"}'
# -> copy the accessToken from the response

# Upload a file
curl -X POST http://localhost:4000/api/files \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/file.pdf" \
  -F "isPublic=true"
```

## Project structure

```
src/
  config/       env + database pool
  controllers/  request handlers (thin — validate input, call services, shape response)
  services/     business logic (auth, file metadata, authorization checks)
  middleware/   auth, validation, multer upload config, error handling
  routes/       route wiring
  db/           SQL migrations + migration runner
  utils/        JWT helpers, ApiError, asyncHandler
storage/        uploaded files live here (gitignored)
```

## What's not included

Given the ~5h scope, a few things were deliberately left out but would be next in a production system:
- Antivirus/malware scanning of uploaded content (e.g. ClamAV) — only extension/MIME allowlisting is done
- Cloud object storage (S3/Cloudinary) — files are stored on local disk behind the API, which is simpler to run for review but doesn't horizontally scale
- Email verification and password reset flows
- Per-user storage quotas
