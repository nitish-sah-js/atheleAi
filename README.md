# AthleteShield Backend

AthleteShield is a privacy-first athlete identity, credential verification, QR validation, and abuse reporting backend. It is a NestJS modular monolith backed by PostgreSQL, Prisma, Redis, BullMQ, encrypted file storage, and a separate FastAPI AI moderation service.

Swagger runs at `http://localhost:4000/docs`.

The REST API is prefixed by `/api/v1`, so the health endpoint is:

```bash
http://localhost:4000/api/v1/health
```

## What You Need Installed

Required:

- Node.js 22 LTS or newer
- npm
- PostgreSQL access, either local Postgres or Supabase/Postgres URL
- Redis, either local Redis or Docker Redis
- Docker Desktop, recommended for Redis and the AI service

Optional:

- Python 3.12+ if you want to run the AI moderation service without Docker
- AWS credentials only if `FILE_STORAGE_DRIVER=s3`

For the current prototype, S3 is not required because uploads are stored encrypted on the server filesystem.

## Install Dependencies

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

## Environment Setup

Create `.env`:

```bash
copy .env.example .env
```

Fill these important values:

```env
DATABASE_URL=...
DIRECT_URL=...
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=...
DOCUMENT_MASTER_KEY_BASE64=...
ED25519_PRIVATE_KEY_PEM_BASE64=...
ED25519_PUBLIC_KEY_PEM_BASE64=...

AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=...

FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=uploads/encrypted
```

For Docker Compose mode, use service hostnames instead:

```env
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://ai-service:8000
```

For local `npm run start:dev`, use localhost:

```env
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
```

## Generate Local Secrets

JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

AES document encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Ed25519 signing keys:

```bash
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey,publicKey}=generateKeyPairSync('ed25519'); console.log('ED25519_PRIVATE_KEY_PEM_BASE64='+Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')); console.log('ED25519_PUBLIC_KEY_PEM_BASE64='+Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"
```

Internal AI service token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Use the AI token as `AI_SERVICE_API_KEY` in both the Nest backend and FastAPI AI service.

## Database Setup

Generate Prisma client:

```bash
npx prisma generate
```

For a prototype database, push the schema:

```bash
npx prisma db push
```

For migration-based development:

```bash
npx prisma migrate dev --name init
```

If you use Supabase pooled runtime URLs, migrations and `db push` should use `DIRECT_URL`. The Prisma schema is already configured with `directUrl = env("DIRECT_URL")`.

## Run Locally

Start Redis. The easiest path is Docker:

```bash
docker compose up -d redis
```

Start the AI moderation service with Docker:

```bash
docker compose up -d ai-service
```

Then run the NestJS backend locally:

```bash
npm run start:dev
```

Open:

```bash
http://localhost:4000/docs
```

## Run Everything With Docker Compose

Make sure `.env` uses Docker service hostnames:

```env
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://ai-service:8000
```

Then run:

```bash
docker compose up --build
```

API:

```bash
http://localhost:4000
```

AI service:

```bash
http://localhost:8000/health
```

## Run AI Service Without Docker

```bash
cd services/ai-moderation
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set AI_SERVICE_API_KEY=your_same_ai_service_key
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then in backend `.env`:

```env
AI_SERVICE_URL=http://localhost:8000
```

## File Storage

Local encrypted storage is enabled by default:

```env
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=uploads/encrypted
```

Uploaded athlete documents and report evidence are encrypted before being written to disk. Raw files are never stored in PostgreSQL.

To use S3 later:

```env
FILE_STORAGE_DRIVER=s3
AWS_REGION=...
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Useful Commands

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Start dev server:

```bash
npm run start:dev
```

Prisma Studio:

```bash
npx prisma studio
```

Seed admin user:

```bash
npm run prisma:seed
```

## Main API Routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `GET /api/v1/athlete/profile`
- `PATCH /api/v1/athlete/profile`
- `POST /api/v1/athlete/documents`
- `POST /api/v1/verification/request`
- `POST /api/v1/verification/approve`
- `POST /api/v1/verification/reject`
- `GET /api/v1/credentials/:id`
- `POST /api/v1/credentials/sign`
- `GET /api/v1/qr/verify/:token`
- `POST /api/v1/reports/anonymous`
- `POST /api/v1/reports/:id/evidence`
- `GET /api/v1/reports/:id/status`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/reports`
- `GET /api/v1/health`
- `GET /api/v1/metrics`

## Troubleshooting

Docker daemon not running:

```bash
docker info
```

If it fails, open Docker Desktop and wait until it is running.

Redis connection errors:

- Local backend needs `REDIS_URL=redis://localhost:6379`.
- Docker backend needs `REDIS_URL=redis://redis:6379`.

AI moderation connection errors:

- Local backend needs `AI_SERVICE_URL=http://localhost:8000`.
- Docker backend needs `AI_SERVICE_URL=http://ai-service:8000`.

Invalid document key error:

- `DOCUMENT_MASTER_KEY_BASE64` must decode to exactly 32 bytes.

Credential signing errors:

- `ED25519_PRIVATE_KEY_PEM_BASE64` and `ED25519_PUBLIC_KEY_PEM_BASE64` must be generated and set.

Prisma engine download errors:

- Run the Prisma command again with internet access:

```bash
npx prisma generate
npx prisma db push
```

## Security Notes

- Do not commit `.env`.
- Keep `.env.example` placeholder-only.
- Rotate any database password or API key that was ever pasted into a public file or chat.
- Local filesystem storage is acceptable for prototype testing; production should use durable object storage and a managed key strategy.
