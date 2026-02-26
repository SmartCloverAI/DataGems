# DataGems

**DataGems** is a commercial-grade synthetic data generation platform that helps teams create high-quality structured datasets quickly, safely, and repeatedly.

It combines a Next.js full-stack app with Ratio1 CStore persistence and strict authentication to support auditable AI-data workflows for product, research, and regulated environments.

## Why DataGems

- Generate synthetic datasets with predictable quality using one model call per record.
- Keep full traceability of jobs, progress, outputs, and metrics in persistent storage.
- Enforce authentication and session control across all API and UI actions.
- Export usable results fast (JSON/CSV) for analytics, testing, and model development.
- Fit modern AI product teams that need delivery speed without compromising governance.

## Ownership and Commercial Context

**Owner:** `SmartClover SRL` (Romania)

DataGems is part of SmartClover SRL's product strategy and aligns with the company's public objectives:

- Human-in-the-loop AI systems.
- Data sovereignty and controlled deployments ("your AI, your Data").
- Practical healthcare AI productization through SaaS/PaaS delivery models.

As published on SmartClover channels (accessed February 17, 2026), SmartClover operates a portfolio that includes:

- **CerviGuard** (MDR Class I cervical cancer screening companion app).
- **Evidence-Linked Healthcare Research Platform**.
- **Digital Resilience Platform for Healthcare**.
- **Creative Education Experience Platform**.

DataGems serves as an enabling layer for synthetic data operations across these product directions and adjacent enterprise use cases.

## Quickstart

1. Install dependencies (Node 18+):
```bash
npm install
```
2. Set environment variables.
   For local mock mode (`admin/admin`), this is enough in `.env.local`:
```bash
DATAGEN_SESSION_SECRET=dev-session-secret-change-me
DATAGEN_MOCK_CSTORE=true
DATAGEN_MOCK_INFERENCE_API=true
R1EN_CHAINSTORE_PEERS=local
R1EN_HOST_ADDR=local
```
3. Run:
```bash
npm run dev
```

## Environment variables

- `EE_CHAINSTORE_API_HOST` / `EE_CHAINSTORE_API_PORT` (required): Ratio1 CStore endpoint (fallback: `EE_CHAINSTORE_API_URL`).
- `EE_R1FS_API_HOST` / `EE_R1FS_API_PORT` (optional): Ratio1 file store (fallback: `EE_R1FS_API_URL`, not used yet).
- `R1EN_CSTORE_AUTH_HKEY`: Hash key for auth (fallback: `EE_CSTORE_AUTH_HKEY`).
- `R1EN_CSTORE_AUTH_SECRET`: Pepper for password hashing (fallback: `EE_CSTORE_AUTH_SECRET`).
- `R1EN_CSTORE_AUTH_BOOTSTRAP_ADMIN_PWD`: Bootstrap admin password (fallback: `EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PWD`, legacy: `EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW`).
- `DATAGEN_SESSION_SECRET`: Secret used to sign session cookies/JWTs.
  In `development`/`test`, if omitted, DataGems uses an insecure built-in fallback secret for local runs only.
- `DATAGEN_APP_HOST` / `DATAGEN_APP_PORT`: Public app host/port (defaults: `$R1EN_HOST_IP` / `3000`, fallback: `DATAGEN_APP_URL`).
- `DATAGEN_INFERENCE_HOST` / `DATAGEN_INFERENCE_PORT`: Inference gateway host/port (defaults: `$R1EN_HOST_IP` / `$API_PORT`, fallback: `DATAGEN_INFERENCE_BASE_URL`).
- `DATAGEN_SMTP_HOST`: SMTP host for signup email delivery (default `smtp.resend.com`).
- `DATAGEN_SMTP_PORT`: SMTP port (default `465`).
- `DATAGEN_SMTP_USER`: SMTP username (default `resend`).
- `DATAGEN_SMTP_PASS`: SMTP password/API key (default empty; optional to define, required to actually send email).
- `DATAGEN_SMTP_FROM`: Sender email (default `no-reply@datagems.app`).
- `R1EN_CHAINSTORE_PEERS`: Peer list for multi-instance execution (comma-separated or JSON array string).
- `R1EN_HOST_ADDR`: Current instance peer id (must match one entry in `R1EN_CHAINSTORE_PEERS`).
- `LOG_INFERENCE_REQUESTS`: When `true`, logs outgoing inference requests (auth header redacted).
- `DATAGEN_LOG_R1FS_CALLS`: When `true`, logs R1FS upload/download start/success/error events.
- `RETRY_INFERENCE_ON_FAILURE`: When `true`, retries one extra inference call on failure/parse errors.
- `NEXT_PUBLIC_SHOW_FAILURES`: When `true`, shows failure counts in UI task cards.
- `DATAGEN_MAX_RECORDS_PER_JOB`: Max records per job (default `200`).
- `DATAGEN_MAX_EXTERNAL_API_CONFIGS`: Max saved external API profiles per user (default `10`).
- `DATAGEN_MOCK_CSTORE`: When `true`, uses in-memory mock CStore/auth (`admin/admin`, `test_user/testtest`). In `development`/`test`, DataGems auto-falls back to mock mode if auth/CStore env is missing.
- `DATAGEN_MOCK_INFERENCE_API`: When `true`, uses in-memory mock inference that returns random JSON records.
- `DATAGEN_JOB_POLL_SECONDS`: Worker poll interval for queued/running jobs (default `5`).
- `DATAGEN_UPDATE_EVERY_K_REQUESTS`: Persist/update cadence during generation (default `5`).
- `DATAGEN_MAX_CONCURRENT_JOBS_PER_INSTANCE`: Max jobs processed in parallel per instance (default `1`).
- `DATAGEN_LOCAL_CACHE_DIR`: Local worker cache directory (default `/_local_cache/datagen`).
- `DATAGEN_ACTIVE_POLL_SECONDS`: UI poll interval while tasks are active (default `10`).
- `DATAGEN_IDLE_POLL_SECONDS`: UI poll interval when idle (default `30`).
- `DATAGEN_REGISTER_RATE_WINDOW_SECONDS`: Registration rate-limit window seconds (default `900`).
- `DATAGEN_REGISTER_MAX_PER_IP`: Max registration attempts per IP per window (default `10`).
- `DATAGEN_REGISTER_MAX_PER_EMAIL`: Max registration attempts per email per window (default `3`).
- `DATAGEN_REGISTER_RESEND_WINDOW_SECONDS`: Resend rate-limit window seconds (default `900`).
- `DATAGEN_REGISTER_RESEND_MAX_PER_IP`: Max resend attempts per IP per window (default `5`).
- `DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL`: Max resend attempts per email per window (default `2`).
- `DATAGEN_REGISTER_FAILURE_TTL_SECONDS`: TTL for failed-email resend records (default `86400`).

## Current API Surface

- `POST /api/auth/login`: Authenticate via `cstore-auth-ts`; sets HttpOnly session cookie.
- `POST /api/auth/logout`: Clears the session.
- `GET /api/auth/me`: Returns current session (`401` when missing/invalid).
- `POST /api/auth/register`: Creates account and emails generated credentials.
- `POST /api/auth/register/resend`: Re-sends credentials for recent failed delivery attempts.
- `GET /api/metrics`: Auth-protected metrics from persisted CStore counters.

## Project layout (high level)

```text
app/
  (auth)/login/page.tsx
  (auth)/register/page.tsx
  (app)/page.tsx
  api/
    auth/login|logout|me|register|register/resend
    metrics/route.ts
lib/
  auth/
  datagen/
  ratio1/
```

## Citation (BibTeX)

```bibtex
@software{smartclover_datagen_2026,
  author       = {{SmartClover SRL}},
  title        = {DataGems: Synthetic Dataset Generation Platform},
  year         = {2026},
  version      = {0.5.0},
  url          = {https://github.com/SmartCloverAI/DataGems},
  organization = {SmartClover SRL},
  note         = {Accessed 2026-02-17}
}
```

## References

- SmartClover official site: https://smartclover.ro/
- SmartClover About: https://smartclover.ro/about
- SmartClover Products & More: https://smartclover.ro/products
- CerviGuard public workspace: https://cerviguard.link
