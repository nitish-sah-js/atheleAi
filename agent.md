# AthleteShield Backend Agent Guide

## Current Status

AthleteShield backend is a NestJS modular monolith prototype with the main security and trust-infrastructure foundations scaffolded:

- NestJS + TypeScript application shell.
- Prisma schema for the required PostgreSQL domain model.
- JWT access tokens, refresh-token rotation, device sessions, RBAC guards.
- AES-256-GCM encryption for uploaded files and sensitive report text.
- Ed25519 credential and QR token signing.
- Encrypted local filesystem storage for development, with S3 still available as a future driver.
- Athlete document upload flow.
- Federation and verification request flow.
- Signed credential issuing flow.
- QR verification with selective disclosure.
- Anonymous abuse reporting with encrypted narrative/evidence and AI moderation queue.
- Audit logging, event listeners, notifications queue, admin endpoints, health and metrics endpoints.
- Docker Compose scaffold with Postgres, Redis, API, and FastAPI AI moderation service.

Last verified locally:

- `npm run build` passes.
- `npm test` passes.
- Prisma schema validation previously passed after Prisma engine access was allowed. After the local-storage change, build/tests passed; Prisma validation may need network/engine permission if the local Prisma engine cache is unavailable.

## Mission

Build AthleteShield as a production-oriented, privacy-first athlete identity and verification backend. The backend exposes REST APIs for a separate Next.js frontend. It must preserve sensitive athlete documents, issue cryptographically signed credentials, support QR verification with selective disclosure, and provide anonymous abuse reporting with auditable workflows.

This is trust infrastructure, not a social app or CRUD demo.

## Non-Negotiable Constraints

- Use Node.js, TypeScript, NestJS, PostgreSQL, Prisma, Redis, BullMQ, JWT, refresh token rotation, AES-256-GCM, Ed25519 signatures, Helmet, throttling, CORS, DTO validation, Docker, Swagger, and structured logging.
- Use local encrypted filesystem storage for the current prototype.
- Keep S3 as a production-ready storage option, but do not require S3 to test locally.
- Do not use Firebase, MongoDB, GraphQL, blockchain, real ZKP, or microservices for the core backend.
- Keep business logic in services and repositories, not controllers.
- Never expose raw documents, plaintext report narratives, or raw public storage URLs.
- Every sensitive access path must be audit-loggable.
- Favor domain modules with clear boundaries over shared catch-all logic.

## Architecture

AthleteShield is a modular monolith:

- `auth`: registration, login, JWTs, refresh-token rotation, device sessions.
- `users`: current user profile and user lookup boundaries.
- `athlete`: athlete profile, athlete IDs, encrypted document upload metadata.
- `federation`: federation records and memberships.
- `verification`: verification requests, claims, decisions, approval/rejection workflow.
- `credential`: signed credentials, credential claims, signing service.
- `qr-verification`: short-lived QR sessions and public verification.
- `abuse-reports`: anonymous reports, encrypted evidence, status workflow, assignment.
- `audit-logs`: append-oriented audit trail service and admin querying.
- `notifications`: async notification queue placeholder.
- `ai-moderation`: Nest client + queue worker for separate FastAPI moderation service.
- `storage`: pluggable encrypted storage, currently local filesystem, later S3.
- `admin`: audit/report operations.
- `health`: liveness/readiness endpoint.
- `metrics`: Prometheus-style metrics endpoint.

## Storage Mode

Current prototype storage is local:

```env
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=uploads/encrypted
```

Upload flow:

1. Validate MIME type and file size.
2. Run malware-scan adapter hook.
3. Encrypt the file with AES-256-GCM.
4. Write ciphertext to `LOCAL_STORAGE_ROOT`.
5. Store only metadata in PostgreSQL: storage key, bucket label, checksum, MIME type, IV, auth tag, algorithm, key version, owner, status.

S3 remains supported behind the same `StorageService` API:

```env
FILE_STORAGE_DRIVER=s3
AWS_REGION=...
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Do not add direct filesystem or S3 logic inside domain modules. Athlete documents and report evidence must always go through `StorageService`.

## Security Model

- Access tokens are short lived and signed with `JWT_ACCESS_SECRET`.
- Refresh tokens are high-entropy random tokens, hashed with HMAC digesting, stored per device session, and rotated on every refresh.
- Device sessions are checked by the JWT guard so revoked sessions stop working.
- RBAC roles are `ATHLETE`, `COACH`, `FEDERATION`, `ADMIN`, `INVESTIGATOR`.
- Admin can pass role checks, but ownership/policy checks still matter for sensitive domain access.
- Documents are encrypted before storage. The database never stores raw file bytes.
- Abuse report narrative and optional reporter contact are encrypted before database storage.
- Credential payloads are canonicalized, hashed with SHA-256, and signed with Ed25519.
- QR verification validates the signed QR token, checks session expiry, verifies credential signature, and returns only allowed claims.
- Anonymous reporting accepts limited metadata, hashes IP/user-agent metadata, encrypts evidence through the storage module, and rate-limits submissions.

## Environment Contract

For local prototype testing, `.env` must include:

```env
NODE_ENV=development
PORT=4000
API_PREFIX=api/v1
APP_NAME=AthleteShield

DATABASE_URL=...
DIRECT_URL=...
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=...
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3000

FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=uploads/encrypted

DOCUMENT_MASTER_KEY_BASE64=...
ED25519_PRIVATE_KEY_PEM_BASE64=...
ED25519_PUBLIC_KEY_PEM_BASE64=...

AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=...

RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_DEFAULT=120
RATE_LIMIT_AUTH=10
RATE_LIMIT_REPORTS=8
RATE_LIMIT_VERIFICATION=60

LOG_LEVEL=info
```

For Docker Compose testing, use service hostnames:

```env
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://ai-service:8000
```

For local `npm run start:dev`, use localhost:

```env
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
```

Important env notes:

- `JWT_ACCESS_SECRET` must be random and at least 32 characters.
- `DOCUMENT_MASTER_KEY_BASE64` must decode to exactly 32 bytes.
- `ED25519_PRIVATE_KEY_PEM_BASE64` and `ED25519_PUBLIC_KEY_PEM_BASE64` must be base64-encoded PEM keys.
- `AI_SERVICE_API_KEY` is an internal service token generated by us. It is not an OpenAI/Gemini key.
- `OPENAI_API_KEY` or `GEMINI_API_KEY` are only needed by the FastAPI service if real provider-backed moderation is used.
- `.env` must never be committed.
- `.env.example` must contain placeholders only.
- If Supabase is used, `DATABASE_URL` may use a pooled connection for runtime. Prisma migrations and `db push` should use `DIRECT_URL`; the Prisma schema is wired with `directUrl = env("DIRECT_URL")`.

Useful local secret generation:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey,publicKey}=generateKeyPairSync('ed25519'); console.log('ED25519_PRIVATE_KEY_PEM_BASE64='+Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')); console.log('ED25519_PUBLIC_KEY_PEM_BASE64='+Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"
```

## Event Flow

Use `@nestjs/event-emitter` internally:

1. `athlete.registered`
2. `document.uploaded`
3. `verification.requested`
4. `verification.approved`
5. `credential.issued`
6. `credential.signed`
7. `qr.generated`
8. `abuse_report.submitted`
9. `severity.classified`

Current side effects:

- Domain events are written into audit logs by `DomainEventAuditListener`.
- Abuse report submission enqueues AI moderation through BullMQ.
- Credential issuing generates a QR session.

## Database Rules

- All IDs are UUIDs.
- All tables include timestamps.
- Soft-delete fields exist where domain records can be retired.
- Foreign keys and frequently queried columns must be indexed.
- Sensitive document content never goes into PostgreSQL.
- Audit logs should be treated as append-only at the application layer.
- Verification decisions and report status history are immutable event records.
- Report admin list must not return encrypted narrative/contact fields.

## REST API Surface

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:

- `GET /users/me`

Athlete:

- `GET /athlete/profile`
- `PATCH /athlete/profile`
- `POST /athlete/documents`

Federation:

- `GET /federations`
- `POST /federations`

Verification:

- `POST /verification/request`
- `POST /verification/approve`
- `POST /verification/reject`

Credentials:

- `GET /credentials/:id`
- `POST /credentials/sign`

QR:

- `GET /qr/verify/:token`

Reports:

- `POST /reports/anonymous`
- `POST /reports/:id/evidence`
- `GET /reports/:id/status`

Admin:

- `GET /admin/audit-logs`
- `GET /admin/reports`
- `PATCH /admin/reports/:id/assign`
- `PATCH /admin/reports/:id/status`

Ops:

- `GET /health`
- `GET /metrics`
- Swagger at `/docs`
- API prefix defaults to `/api/v1`

## Verification Lifecycle

1. Athlete uploads encrypted evidence documents.
2. Athlete/coach/federation creates a verification request.
3. Federation/admin approves or rejects claims.
4. Approval creates immutable verification decision records.
5. Approval issues a signed credential.
6. Credential service canonicalizes payload, hashes it, signs it with Ed25519, stores claims.
7. QR service creates a signed short-lived QR token with allowed claims.
8. Public QR verification returns only non-private allowed claims.

## Abuse Report Lifecycle

1. Reporter submits anonymous narrative.
2. Narrative and optional contact are encrypted before DB write.
3. Public tracking ID is returned.
4. AI moderation job is queued.
5. AI service classifies severity, toxicity score, summary, and repeated incident hints.
6. Report transitions to triaged when moderation completes.
7. Admin assigns investigator.
8. Investigator/admin updates status with immutable history.
9. Evidence uploads are encrypted through the same storage boundary.

## Local Testing Checklist

1. Ensure `.env` uses matching execution mode:
   - local: `REDIS_URL=redis://localhost:6379`, `AI_SERVICE_URL=http://localhost:8000`
   - Docker: `REDIS_URL=redis://redis:6379`, `AI_SERVICE_URL=http://ai-service:8000`
2. Start Redis.
3. Start Postgres or ensure Supabase DB is reachable.
4. Apply Prisma migrations.
5. Start FastAPI AI service if testing report moderation.
6. Run backend:

```bash
npm run build
npm test
npm run start:dev
```

Docker path:

```bash
docker compose up --build
```

Prisma path:

```bash
npx prisma generate
npx prisma migrate dev
```

If Prisma engine download/cache access fails under sandboxing, rerun with network permission or ensure the Prisma engine is already cached.

## Implementation Style

- Controllers perform validation and HTTP orchestration only.
- Services own domain decisions and emit events.
- Repositories wrap Prisma access and keep query details out of services.
- DTOs use `class-validator` and Swagger decorators.
- Guards, decorators, filters, interceptors, crypto, cache, and rate-limit utilities live in `src/common`.
- Shared utilities must be narrow and stable; avoid broad god services.
- Every endpoint response should be frontend-friendly and avoid leaking persistence internals.
- Do not bypass existing modules to make a quick feature work.

## Known Follow-Ups

- Remove the direct `multer` dependency or upgrade it safely. Nest currently brings Multer 2 transitively, but `package.json` still lists old Multer.
- Consider upgrading the Nest stack to patched Nest 11 packages after testing compatibility.
- Confirm the Supabase `DIRECT_URL` is a true direct/session connection before applying schema changes.
- Add integration/e2e tests for auth, upload, verification approval, credential signing, QR verification, and report workflow.
- Add real malware scanner adapter for uploaded files.
- Add stronger ownership/policy checks around verification request creation and document evidence access.
- Add KMS/HSM-backed key management before production.
- Add production object lifecycle policies if using S3 later.
- Add CI secret scanning and dependency audit gates before public repo use.

## Future Extension Points

- Credential signer can later support KMS/HSM without changing credential APIs.
- Access policy model can add organization-specific selective disclosure rules.
- QR sessions can later move to opaque token introspection.
- AI moderation client can swap providers behind the module boundary.
- WebSocket/mobile clients can subscribe to notification events without rewriting core workflows.
- DID/ZKP support can be added as alternate credential proof strategies.
