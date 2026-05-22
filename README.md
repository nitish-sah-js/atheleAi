# AthleteShield Backend

Privacy-first athlete identity, credential verification, QR validation, and abuse reporting backend.  
Built as a **NestJS modular monolith** backed by PostgreSQL, Prisma, Redis, BullMQ, AES-256-GCM encrypted file storage, and a separate FastAPI AI moderation micro-service.

- **Swagger UI**: `http://localhost:4000/docs`
- **API prefix**: `/api/v1`
- **Health check**: `GET http://localhost:4000/api/v1/health`

---

## Required Versions

| Tool | Minimum Version | Recommended |
|------|----------------|-------------|
| **Node.js** | 22.x LTS | 22.x LTS |
| **npm** | 10.x | (ships with Node 22) |
| **PostgreSQL** | 15 | 16 |
| **Redis** | 7.x | 7-alpine (Docker) |
| **TypeScript** | 5.7 | 5.7+ |
| **Prisma** | 6.1 | 6.1+ |
| **NestJS** | 10.4 | 10.4+ |
| **Docker** (optional) | 24+ | Latest |
| **Python** (optional, AI service) | 3.12+ | 3.12+ |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Copy and configure environment
copy .env.example .env
# Edit .env with your values (see Environment Reference below)

# 4. Generate secrets
node generate-key.js
# Or generate manually (see Generating Secrets section)

# 5. Push database schema
npx prisma db push

# 6. Start Redis (via Docker)
docker compose up -d redis

# 7. Start AI moderation service (via Docker)
docker compose up -d ai-service

# 8. Start the backend
npm run start:dev

# 9. Open Swagger
# http://localhost:4000/docs
```

---

## Environment Reference

Create `.env` from the example:

```bash
copy .env.example .env
```

### All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |
| `PORT` | No | `4000` | Server port |
| `API_PREFIX` | No | `api/v1` | REST API prefix |
| `APP_NAME` | No | `AthleteShield` | Application name |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (pooled URL for Supabase) |
| `DIRECT_URL` | **Yes** | — | Direct PostgreSQL URL for migrations (non-pooled for Supabase) |
| `REDIS_URL` | **Yes** | — | Redis connection string |
| `JWT_ACCESS_SECRET` | **Yes** | — | JWT signing secret, **minimum 32 characters** |
| `JWT_ACCESS_TTL` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | No | `30` | Refresh token lifetime in days |
| `COOKIE_DOMAIN` | No | `localhost` | Cookie domain |
| `COOKIE_SECURE` | No | `false` | Set `true` in production (HTTPS) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `FILE_STORAGE_DRIVER` | No | `local` | `local` or `s3` |
| `LOCAL_STORAGE_ROOT` | No | `uploads/encrypted` | Local encrypted file storage path |
| `AWS_REGION` | If S3 | `us-east-1` | AWS region |
| `AWS_S3_BUCKET` | If S3 | — | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | If S3 | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If S3 | — | AWS secret key |
| `AWS_S3_ENDPOINT` | No | — | Custom S3 endpoint (MinIO, etc.) |
| `AWS_S3_FORCE_PATH_STYLE` | No | `false` | Force path-style S3 URLs |
| `DOCUMENT_MASTER_KEY_BASE64` | **Yes** | — | AES-256 key, **must decode to exactly 32 bytes** |
| `ED25519_PRIVATE_KEY_PEM_BASE64` | No | `""` | Ed25519 private key (Base64 PEM) for credential signing |
| `ED25519_PUBLIC_KEY_PEM_BASE64` | No | `""` | Ed25519 public key (Base64 PEM) for credential verification |
| `AI_SERVICE_URL` | **Yes** | — | AI moderation service URL |
| `AI_SERVICE_API_KEY` | **Yes** | — | Shared Bearer token for AI service auth |
| `RATE_LIMIT_TTL_SECONDS` | No | `60` | Rate limit window |
| `RATE_LIMIT_DEFAULT` | No | `120` | Default requests per window |
| `RATE_LIMIT_AUTH` | No | `10` | Auth endpoint limit |
| `RATE_LIMIT_REPORTS` | No | `8` | Report submission limit |
| `RATE_LIMIT_VERIFICATION` | No | `60` | Verification endpoint limit |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `SEED_ADMIN_EMAIL` | No | — | Admin email for `prisma:seed` |
| `SEED_ADMIN_PASSWORD` | No | — | Admin password for `prisma:seed` |

### Local Dev Example

```env
DATABASE_URL=postgresql://athleteshield:athleteshield@localhost:5432/athleteshield?schema=public
DIRECT_URL=postgresql://athleteshield:athleteshield@localhost:5432/athleteshield?schema=public
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
```

### Docker Compose Example

```env
DATABASE_URL=postgresql://athleteshield:athleteshield@postgres:5432/athleteshield?schema=public
DIRECT_URL=postgresql://athleteshield:athleteshield@postgres:5432/athleteshield?schema=public
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://ai-service:8000
```

---

## Generating Secrets

```bash
# JWT secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# AES-256 document encryption key (exactly 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Ed25519 signing keys
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey,publicKey}=generateKeyPairSync('ed25519'); console.log('ED25519_PRIVATE_KEY_PEM_BASE64='+Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')); console.log('ED25519_PUBLIC_KEY_PEM_BASE64='+Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"

# AI service API key
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Use the same `AI_SERVICE_API_KEY` value in both the NestJS `.env` and the AI service environment.

---

## Database Setup

```bash
# Generate Prisma client (required before build)
npx prisma generate

# Prototype — push schema directly
npx prisma db push

# Production — migration-based
npx prisma migrate dev --name init   # development
npx prisma migrate deploy            # production/staging

# Seed admin user
npm run prisma:seed

# Browse data
npx prisma studio
```

If using Supabase, `DATABASE_URL` should be the pooled/transaction URL and `DIRECT_URL` should be the session/direct URL. The Prisma schema uses `directUrl = env("DIRECT_URL")`.

---

## Running the Backend

### Local Development

```bash
docker compose up -d redis           # Start Redis
docker compose up -d ai-service      # Start AI service
npm run start:dev                     # Start NestJS (watch mode, port 4000)
```

### Full Docker Compose

```bash
docker compose up --build
# API:         http://localhost:4000
# Swagger:     http://localhost:4000/docs
# AI service:  http://localhost:8000/health
```

### AI Service Without Docker

```bash
cd services/ai-moderation
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set AI_SERVICE_API_KEY=your_key_here
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload (port 4000) |
| `npm run build` | Production build to `dist/` |
| `npm start` | Run production build |
| `npm test` | Unit tests (serial, `--runInBand`) |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations (dev) |
| `npm run prisma:deploy` | Deploy migrations (prod) |
| `npm run prisma:seed` | Seed admin user |
| `npm run prisma:studio` | Prisma Studio GUI |

---

## Security Model

| Layer | Implementation |
|-------|---------------|
| **File encryption** | AES-256-GCM — all uploads encrypted before storage |
| **Credential signing** | Ed25519 — digitally signed verifiable credentials |
| **Password hashing** | Argon2 |
| **Token rotation** | Refresh tokens are high-entropy, HMAC-hashed, rotated on every refresh |
| **RBAC** | 5 roles: `ATHLETE`, `COACH`, `FEDERATION`, `ADMIN`, `INVESTIGATOR` |
| **Anonymous reports** | Narrative encrypted, IP/user-agent hashed, rate-limited |
| **Audit logs** | Append-only via `AuditInterceptor` on all requests |
| **Rate limiting** | Redis-backed throttling via `@nestjs/throttler` |
| **Headers** | Helmet security headers |
| **Input validation** | `class-validator` whitelist mode, `forbidNonWhitelisted` |

---

## Architecture

```
src/
├── main.ts                         # Bootstrap (Helmet, CORS, Swagger, ValidationPipe)
├── app.module.ts                   # Root module — wires 15+ domain modules
├── config/env.validation.ts        # Zod env schema — validates all env vars at startup
├── common/
│   ├── guards/                     # ThrottlerGuard → JwtAuthGuard → RolesGuard
│   ├── filters/                    # GlobalExceptionFilter
│   ├── interceptors/               # AuditInterceptor
│   ├── crypto/                     # CryptoService (AES-256-GCM, Ed25519, HMAC)
│   ├── cache/                      # Redis cache module
│   ├── rate-limit/                 # Redis-backed throttler
│   └── middleware/                 # RequestContextMiddleware
├── prisma/                         # PrismaModule + PrismaService
├── events/                         # Domain event listeners (audit, BullMQ)
└── modules/
    ├── auth/                       # Register, login, refresh, logout
    ├── users/                      # User profile (GET /users/me)
    ├── athlete/                    # Athlete profile + document upload
    ├── federation/                 # Federation CRUD
    ├── verification/               # Verification requests + approval
    ├── credential/                 # Signed credentials
    ├── qr-verification/            # QR session + public verify
    ├── abuse-reports/              # Anonymous reports + evidence
    ├── storage/                    # Encrypted file storage (local/S3)
    ├── admin/                      # Admin dashboard (audit logs, reports)
    ├── audit-logs/                 # Audit log queries
    ├── notifications/              # In-app + email notifications
    ├── ai-moderation/              # AI content moderation (BullMQ)
    ├── health/                     # Health check endpoint
    └── metrics/                    # Prometheus metrics
services/
└── ai-moderation/                  # FastAPI AI service (port 8000)
```

---

## Frontend Integration Guide (LLM-Optimized)

> **This section is written for LLMs building a frontend.** It contains the exact API contract — base URL, auth flow, headers, request bodies, and response shapes for every endpoint.

### Base Configuration

```typescript
const API_BASE = "http://localhost:4000/api/v1";

// All requests need these headers:
const headers = {
  "Content-Type": "application/json",
};

// Authenticated requests add:
const authHeaders = {
  ...headers,
  "Authorization": `Bearer ${accessToken}`,
};
```

### CORS

The backend allows origins listed in `CORS_ORIGINS` (default: `http://localhost:3000`).  
Set `CORS_ORIGINS=http://localhost:3000,http://localhost:5173` for multiple frontends.  
Credentials (`cookies`) are enabled. Allowed methods: `GET, POST, PATCH, PUT, DELETE, OPTIONS`.  
Allowed headers: `Content-Type, Authorization, X-Request-Id`.

### RBAC Roles

```
ATHLETE        — Default role for new registrations
COACH          — Can manage athletes
FEDERATION     — Can verify credentials, manage members
ADMIN          — Full access, can manage reports and audit logs
INVESTIGATOR   — Can investigate abuse reports
```

---

### API Endpoints — Complete Reference

#### 1. Authentication

**Register**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "athlete@example.com",
  "password": "securePassword123",     // min 12 chars
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "ATHLETE",                   // optional, default ATHLETE
  "primarySport": "Swimming",          // optional
  "dateOfBirth": "2000-01-15"          // optional, ISO date
}
```

**Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "athlete@example.com",
  "password": "securePassword123"
}

// Response:
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "dGhpcyBp...",
  "user": { "id": "uuid", "email": "...", "roles": ["ATHLETE"] }
}
```

**Refresh Token**
```http
POST /api/v1/auth/refresh
Content-Type: application/json
Authorization: Bearer <accessToken>

{
  "refreshToken": "dGhpcyBp..."   // min 32 chars
}
```

**Logout**
```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>

{
  "refreshToken": "dGhpcyBp..."
}
```

#### 2. Users

**Get Current User**
```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

#### 3. Athlete Profile

**Get Profile**
```http
GET /api/v1/athlete/profile
Authorization: Bearer <accessToken>
```

**Update Profile**
```http
PATCH /api/v1/athlete/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "dateOfBirth": "2000-01-15",        // optional
  "gender": "Female",                  // optional
  "nationality": "US",                 // optional
  "primarySport": "Swimming",          // optional
  "clubName": "AquaElite"              // optional
}
```

**Upload Document**
```http
POST /api/v1/athlete/documents
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <binary>                         // PDF, JPEG, PNG, WEBP, MP4, MPEG, WAV, DOC, DOCX (max 20MB)
documentType: "ID_PROOF"              // ID_PROOF | MEDICAL_RECORD | CERTIFICATE | ACHIEVEMENT | EVIDENCE | OTHER
```

#### 4. Federations

```http
GET  /api/v1/federations               # List federations
POST /api/v1/federations               # Create federation
     { "name": "...", "country": "...", "sport": "...", "registrationNumber": "..." }
```

#### 5. Verification

**Request Verification**
```http
POST /api/v1/verification/request
Authorization: Bearer <accessToken>

{
  "athleteProfileId": "uuid",
  "federationId": "uuid",
  "purpose": "Age verification for competition",
  "claims": [
    { "claimKey": "age_over_18", "claimValue": true, "evidenceDocumentId": "uuid" }
  ]
}
```

**Approve / Reject**
```http
POST /api/v1/verification/approve
Authorization: Bearer <accessToken>
{ "verificationRequestId": "uuid" }

POST /api/v1/verification/reject
Authorization: Bearer <accessToken>
{ "verificationRequestId": "uuid", "reason": "..." }
```

#### 6. Credentials

```http
GET  /api/v1/credentials/:id           # Get credential by ID
POST /api/v1/credentials/sign          # Sign a credential
     { "credentialId": "uuid" }
```

#### 7. QR Verification

```http
GET /api/v1/qr/verify/:token           # Public — no auth required
```

#### 8. Abuse Reports (Anonymous)

**Submit Report** — No auth required
```http
POST /api/v1/reports/anonymous

{
  "title": "Report title",                  // optional
  "narrative": "Detailed description...",    // required, min 20 chars
  "subjectAthleteId": "uuid",               // optional
  "reporterContact": "email@example.com"    // optional, encrypted at rest
}

// Response:
{ "trackingId": "ASR-XXXXXXXX", "status": "SUBMITTED", "severity": "UNKNOWN" }
```

**Check Report Status**
```http
GET /api/v1/reports/:trackingId/status
```

**Add Evidence**
```http
POST /api/v1/reports/:trackingId/evidence
Content-Type: multipart/form-data

file: <binary>
```

#### 9. Admin

```http
GET   /api/v1/admin/audit-logs                    # Query audit logs
GET   /api/v1/admin/reports                        # List open reports
PATCH /api/v1/admin/reports/:id/assign             # Assign investigator
      { "investigatorUserId": "uuid" }
PATCH /api/v1/admin/reports/:id/status             # Update report status
      { "status": "INVESTIGATING", "reason": "..." }
```

#### 10. System

```http
GET /api/v1/health                     # Health check (public)
GET /api/v1/metrics                    # Prometheus metrics
```

---

### Frontend Integration Patterns

#### Axios Setup Example

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      const { data } = await api.post("/auth/refresh", { refreshToken });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### Fetch Setup Example

```typescript
const API_BASE = "http://localhost:4000/api/v1";

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// Usage:
const user = await apiRequest("/users/me");
```

#### File Upload Example

```typescript
async function uploadDocument(file: File, documentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  return api.post("/athlete/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
```

#### Error Response Shape

All errors follow this structure:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Validation errors include an array of messages:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than 12 characters"],
  "error": "Bad Request"
}
```

---

### Verification → Credential → QR Flow

```
1. Athlete uploads encrypted docs     →  POST /athlete/documents
2. Verification request with claims   →  POST /verification/request
3. Federation approves                →  POST /verification/approve
4. Credential is signed (Ed25519)     →  POST /credentials/sign
5. QR session with selective disclose →  (generated server-side)
6. Public QR verify                   →  GET  /qr/verify/:token (no auth)
```

---

## File Storage

Local encrypted storage is the default:

```env
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=uploads/encrypted
```

All uploaded files are **AES-256-GCM encrypted** before being written to disk. Raw files are never stored.

To switch to S3:

```env
FILE_STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Allowed file types: `PDF, JPEG, PNG, WEBP, MP4, MPEG, WAV, DOC, DOCX`. Max size: **20MB**.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Docker daemon not running | Open Docker Desktop, run `docker info` to verify |
| Redis connection refused | Local: `REDIS_URL=redis://localhost:6379` / Docker: `redis://redis:6379` |
| AI service connection error | Local: `AI_SERVICE_URL=http://localhost:8000` / Docker: `http://ai-service:8000` |
| Invalid document key | `DOCUMENT_MASTER_KEY_BASE64` must decode to **exactly 32 bytes** |
| Credential signing fails | Generate and set both `ED25519_*` keys |
| Prisma engine download error | Re-run `npx prisma generate` with internet access |
| CORS errors from frontend | Add your frontend URL to `CORS_ORIGINS` in `.env` |
| 429 Too Many Requests | Rate limit hit — adjust `RATE_LIMIT_*` vars or wait |

---

## Security Notes

- **Never commit `.env`** — it's in `.gitignore`.
- Keep `.env.example` placeholder-only — no real secrets.
- Rotate any key that was ever exposed publicly.
- Local file storage is for prototyping; production should use durable object storage + managed KMS.
- All database IDs are UUIDs; all tables have timestamps.
