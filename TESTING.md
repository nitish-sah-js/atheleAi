# AthleteShield — Manual Testing Guide

This guide walks through testing every major API endpoint with `curl`.  
All commands are designed for **PowerShell**. For Git Bash / WSL, replace `` `n` `` with `\n` and `@file.json` with inline `'...'` JSON.

---

## 1. Prerequisites

- Backend running on `http://localhost:4000`
- Redis running (`docker compose up -d redis`)

Verify:
```powershell
curl.exe -s http://localhost:4000/api/v1/health
```

Expected:
```json
{"status":"ok","service":"athleteshield-api","timestamp":"..."}
```

---

## 2. Auth — Register

Creates a new user. Passwords must be **≥ 12 characters**.

```powershell
$body = '{
  "email":"athlete@test.com",
  "password":"strongpass123!",
  "firstName":"John",
  "lastName":"Doe",
  "role":"ATHLETE",
  "primarySport":"Basketball"
}'
$body | Set-Content "$env:TEMP\register.json" -Encoding ASCII
$reg = curl.exe -s -X POST http://localhost:4000/api/v1/auth/register `
  -H "Content-Type: application/json" -d "@$env:TEMP\register.json"
$reg | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: returns `accessToken`, `refreshToken`, `user` object.

**Save tokens for later:**
```powershell
$token  = ($reg | ConvertFrom-Json).accessToken
$refresh = ($reg | ConvertFrom-Json).refreshToken
```

---

## 3. Auth — Login

```powershell
$body = '{"email":"athlete@test.com","password":"strongpass123!"}'
$body | Set-Content "$env:TEMP\login.json" -Encoding ASCII
$login = curl.exe -s -X POST http://localhost:4000/api/v1/auth/login `
  -H "Content-Type: application/json" -d "@$env:TEMP\login.json"
$login | ConvertFrom-Json | ConvertTo-Json -Depth 10
$token  = ($login | ConvertFrom-Json).accessToken
$refresh = ($login | ConvertFrom-Json).refreshToken
```

Expected: same format as register — tokens + user.

---

## 4. Auth — Refresh Token

Tokens expire in 15m. Use refresh to get new ones:

```powershell
$body = "{`"refreshToken`":`"$refresh`"}"
$body | Set-Content "$env:TEMP\refresh.json" -Encoding ASCII
$refreshed = curl.exe -s -X POST http://localhost:4000/api/v1/auth/refresh `
  -H "Content-Type: application/json" -d "@$env:TEMP\refresh.json"
$refreshed | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 5. Auth — Logout

Revokes the refresh token:

```powershell
$body = "{`"refreshToken`":`"$refresh`"}"
$body | Set-Content "$env:TEMP\logout.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/auth/logout `
  -H "Content-Type: application/json" -d "@$env:TEMP\logout.json"
```

Expected: `{"message":"Logged out successfully"}`

---

## 6. User — Get Current Profile

```powershell
curl.exe -s http://localhost:4000/api/v1/users/me `
  -H "Authorization: Bearer $token" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: user object with `id`, `email`, `roles`, `athleteProfile`, etc.

---

## 7. Athlete — Update Profile

Only supplied fields are updated.

```powershell
$body = '{
  "dateOfBirth":"2000-06-15",
  "gender":"male",
  "nationality":"US",
  "clubName":"Athletes United"
}'
$body | Set-Content "$env:TEMP\athlete.json" -Encoding ASCII
curl.exe -s -X PATCH http://localhost:4000/api/v1/athlete/profile `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" -d "@$env:TEMP\athlete.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 8. Federation — Create (FEDERATION role only)

ATHLETE role will get **403**. Register a FEDERATION user first, then:

```powershell
$body = '{"name":"National Basketball Assoc","country":"USA","sport":"Basketball"}'
$body | Set-Content "$env:TEMP\fed.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/federations `
  -H "Authorization: Bearer $fedToken" `
  -H "Content-Type: application/json" -d "@$env:TEMP\fed.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: returns `id`, `name`, `country`, `sport`, `status: "PENDING"`.

### Register as FEDERATION role

```powershell
$body = '{
  "email":"federation@test.com",
  "password":"strongpass123!",
  "firstName":"Fed",
  "lastName":"Admin",
  "role":"FEDERATION"
}'
$body | Set-Content "$env:TEMP\reg-fed.json" -Encoding ASCII
$fedReg = curl.exe -s -X POST http://localhost:4000/api/v1/auth/register `
  -H "Content-Type: application/json" -d "@$env:TEMP\reg-fed.json"
$fedToken = ($fedReg | ConvertFrom-Json).accessToken
```

---

## 9. Verification — Request

Requires an athlete profile ID and a federation ID (from step 8).

```powershell
$body = '{
  "athleteProfileId":"<athleteProfileId-from-users/me>",
  "federationId":"<federationId-from-step-8>",
  "purpose":"Age verification",
  "claims":[{"claimKey":"age","claimValue":"18+"}]
}'
$body | Set-Content "$env:TEMP\ver-req.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/verification/request `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" -d "@$env:TEMP\ver-req.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: returns verification request with `status: "REQUESTED"` and `id`.

---

## 10. Verification — Approve (FEDERATION role)

```powershell
$body = '{
  "verificationRequestId":"<uuid-from-step-9>",
  "credentialType":"AGE_VERIFIED",
  "approvedClaims":[{"claimKey":"age","claimValue":"18+"}]
}'
$body | Set-Content "$env:TEMP\ver-app.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/verification/approve `
  -H "Authorization: Bearer $fedToken" `
  -H "Content-Type: application/json" -d "@$env:TEMP\ver-app.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: returns credential with `status: "ISSUED"` and `id`.

---

## 11. Verification — Reject (FEDERATION role)

```powershell
$body = '{"verificationRequestId":"<uuid>","reason":"Insufficient evidence"}'
$body | Set-Content "$env:TEMP\ver-rej.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/verification/reject `
  -H "Authorization: Bearer $fedToken" `
  -H "Content-Type: application/json" -d "@$env:TEMP\ver-rej.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 12. Credential — Sign (FEDERATION role)

Optional: create a QR session with selective disclosure claims.

```powershell
$body = '{"credentialId":"<uuid-from-step-10>","allowedClaims":["age"]}'
$body | Set-Content "$env:TEMP\cred-sign.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/credentials/sign `
  -H "Authorization: Bearer $fedToken" `
  -H "Content-Type: application/json" -d "@$env:TEMP\cred-sign.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 13. Credential — Get by ID

```powershell
curl.exe -s http://localhost:4000/api/v1/credentials/<uuid-from-step-10> `
  -H "Authorization: Bearer $token" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 14. QR — Verify

Get the QR token from the credential sign response, then:

```powershell
curl.exe -s http://localhost:4000/api/v1/qr/verify/<signedToken> `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Note: This is a **public** endpoint (no auth required). Returns only allowed claims.

---

## 15. Reports — Submit Anonymous

No auth required, but `narrative` must be ≥ 20 characters.

```powershell
$body = '{
  "title":"Suspected misconduct",
  "narrative":"I witnessed repeated verbal harassment during training sessions over the past month.",
  "subjectAthleteId":"<optional-athleteProfileId>",
  "reporterContact":"optional@email.com"
}'
$body | Set-Content "$env:TEMP\report.json" -Encoding ASCII
curl.exe -s -X POST http://localhost:4000/api/v1/reports/anonymous `
  -H "Content-Type: application/json" -d "@$env:TEMP\report.json" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: `publicTrackingId`, `status: "SUBMITTED"`.

---

## 16. Reports — Check Status

Accepts either the UUID `id` or the `publicTrackingId` (e.g. `ASR-XXXXXXXX`).

```powershell
curl.exe -s http://localhost:4000/api/v1/reports/<trackingId-or-UUID>/status `
  -H "Authorization: Bearer $token" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 17. Admin — List Reports (ADMIN/INVESTIGATOR role)

```powershell
curl.exe -s http://localhost:4000/api/v1/admin/reports `
  -H "Authorization: Bearer $adminToken" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 18. Admin — Audit Logs

```powershell
curl.exe -s http://localhost:4000/api/v1/admin/audit-logs `
  -H "Authorization: Bearer $adminToken" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 19. Metrics

```powershell
curl.exe -s http://localhost:4000/api/v1/metrics
```

Returns Prometheus-style text.

---

## 20. Swagger UI

Open in browser:  
**http://localhost:4000/docs**

---

## Troubleshooting

| Error | Fix |
|---|---|
| `401 Unauthorized` | Token expired. Login again or refresh. |
| `403 Forbidden` | Your role lacks permission. Use correct role. |
| `EADDRINUSE` | Another process on port 4000. Kill with: `Get-NetTCPConnection -LocalPort 4000 \| Stop-Process` |
| `ECONNREFUSED` | Backend not running. Run `npm run start:dev`. |
| Redis errors | Ensure `docker compose up -d redis` is running. |
| `Invalid environment configuration` | Check `.env` has all required values (see `.env.example`). |

## Full End-to-End Flow

```
Register (ATHLETE)  →  Login  →  Update Profile
Register (FEDERATION)  →  Login  →  Create Federation
Request Verification (ATHLETE)  →  Approve (FEDERATION)  →  Sign Credential  →  QR Verify
```
