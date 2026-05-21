# AthleteShield — Agent Guide

## Quick start
```bash
npm install
npx prisma generate           # generate Prisma client (required before build)
npm run build
npm test                       # jest --runInBand (serial)
docker compose up -d redis     # start Redis for local dev
npm run start:dev              # nest start --watch on :4000
```

## Essential commands
| Command | What |
|---|---|
| `npm test` | Unit tests (`.spec.ts`), **serial** (`--runInBand`), path alias `@/` → `src/` |
| `npm run test:e2e` | E2E tests (`.e2e-spec.ts`), config at `test/jest-e2e.json` |
| `npm run lint` | ESLint flat config (`eslint.config.mjs`), `--fix` |
| `npm run format` | Prettier (singleQuote, trailingComma all, printWidth 100, semi) |
| `npm run build` | `nest build` — deletes `dist/` then rebuilds |
| `npm run prisma:seed` | `prisma db seed` (uses `prisma/seed.ts`) |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (prod/staging) |

## Architecture
- **NestJS modular monolith** — 15 domain modules under `src/modules/`
- **Global guards** (order matters): ThrottlerGuard → JwtAuthGuard → RolesGuard
- **Global interceptor**: AuditInterceptor (logs all requests)
- **Global filter**: GlobalExceptionFilter
- **Global middleware**: RequestContextMiddleware (all routes)
- **Env validation**: Zod schema in `src/config/env.validation.ts` — all env vars checked at startup
- **API prefix**: `/api/v1`, Swagger at `/docs`
- **Path alias**: `@/` maps to `src/` in tsconfig and jest config
- **Storage**: Pluggable via `StorageService` — default is local encrypted filesystem (`uploads/encrypted`), S3 driver available
- **PM2**: `ecosystem.config.js` for production cluster mode

## Database (Prisma + PostgreSQL)
- **PostgreSQL only** — no SQLite, no in-memory DB for tests
- Migration URL uses `DIRECT_URL` env var (separate from pooler `DATABASE_URL`)
- Schema at `prisma/schema.prisma`, uses `directUrl = env("DIRECT_URL")`
- All IDs are UUIDs, all tables have timestamps
- CI requires real Postgres + Redis services (see `.github/workflows/ci.yml`)

## Testing gotchas
- **No in-memory DB** — tests need a real PostgreSQL database via `DATABASE_URL`
- Tests need `REDIS_URL` (rate limiting + BullMQ use Redis)
- Run **serial** with `--runInBand` — parallel will fail
- E2E tests match `*.e2e-spec.ts`, unit tests match `*.spec.ts`
- Minimal CI env vars for tests (see `.github/workflows/ci.yml:39-45`)

## AI Moderation Service
- FastAPI service in `services/ai-moderation/`, port 8000
- Authenticated via `AI_SERVICE_API_KEY` (Bearer token, shared with backend)
- Providers: heuristic (default, no API key needed), OpenAI, Gemini
- Runs standalone — `uvicorn app.main:app --port 8000`
- Docker: `docker compose up -d ai-service`

## Key env quirks
- `DOCUMENT_MASTER_KEY_BASE64` must decode to **exactly 32 bytes** (AES-256)
- `JWT_ACCESS_SECRET` must be at least 32 characters
- `ED25519_PRIVATE_KEY_PEM_BASE64` / `ED25519_PUBLIC_KEY_PEM_BASE64` are **optional** (default `""`) — leave blank unless signing credentials
- `CORS_ORIGINS` is comma-separated (parsed in `env.validation.ts`)
- `nest-cli.json` has `@nestjs/swagger/plugin` — DTO decorators auto-generated
- Prisma config uses new `defineConfig` format (`prisma.config.ts`)

## Security model
- AES-256-GCM for all file/document/report encryption
- Ed25519 for credential + QR signing
- Refresh tokens: high-entropy random, HMAC-hashed, rotated on every refresh
- RBAC roles: `ATHLETE`, `COACH`, `FEDERATION`, `ADMIN`, `INVESTIGATOR`
- Anonymous reports: narrative encrypted before DB write, IP/user-agent hashed, rate-limited
- Audit logs are append-only at application layer

## Verification → Credential → QR flow
1. Athlete uploads encrypted docs → 2. Verification request with claims → 3. Approval issues signed credential (Ed25519) → 4. QR session created with selective disclosure → 5. Public QR verify returns only allowed claims

## File structure
```
src/
  main.ts                    # Bootstrap (Helmet, CORS, Swagger, ValidationPipe, cookieParser)
  app.module.ts              # Root module wiring all 15+ domain modules + global providers
  config/env.validation.ts   # Zod env schema + validation
  common/                    # Guards, filters, interceptors, crypto, cache, rate-limit, middleware
  prisma/                    # PrismaModule, PrismaService
  events/                    # Domain event listeners (audit log, BullMQ enqueue)
  modules/                   # 15 domain modules (auth, athlete, verification, credential, etc.)
services/ai-moderation/      # FastAPI moderation service (separate process/Docker)
prisma/schema.prisma         # Full Postgres schema (26 models, 20+ enums)
```
