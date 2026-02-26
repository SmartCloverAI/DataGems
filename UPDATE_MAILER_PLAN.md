# UPDATE_MAILER_PLAN

## Prerequisite
This section is **human-only** (do not automate in agent scripts).

1. Create a `resend.com` account and enable MFA.
2. Verify a sender domain (recommended) or sender identity.
3. Configure DNS records required by Resend (SPF, DKIM, DMARC recommended).
4. Create a Resend API key for SMTP.
5. Set app env values:
   - `DATAGEN_SMTP_HOST=smtp.resend.com`
   - `DATAGEN_SMTP_PORT=465`
   - `DATAGEN_SMTP_USER=resend`
   - `DATAGEN_SMTP_PASS=<resend_api_key>` (optional for PoC; defaults listed below)
   - `DATAGEN_SMTP_FROM=no-reply@datagems.app`
6. Confirm free-tier limits and set app throttles below provider caps.

## New Env Vars (with defaults)
Use these defaults so setup stays lightweight for PoC.

1. `DATAGEN_SMTP_HOST` default: `smtp.resend.com`
2. `DATAGEN_SMTP_PORT` default: `465`
3. `DATAGEN_SMTP_USER` default: `resend`
4. `DATAGEN_SMTP_FROM` default: `no-reply@datagems.app`
5. `DATAGEN_SMTP_PASS` default: `""` (empty, optional, not required to be defined)
6. `DATAGEN_REGISTER_RATE_WINDOW_SECONDS` default: `900`
7. `DATAGEN_REGISTER_MAX_PER_IP` default: `10`
8. `DATAGEN_REGISTER_MAX_PER_EMAIL` default: `3`
9. `DATAGEN_REGISTER_RESEND_WINDOW_SECONDS` default: `900`
10. `DATAGEN_REGISTER_RESEND_MAX_PER_IP` default: `5`
11. `DATAGEN_REGISTER_RESEND_MAX_PER_EMAIL` default: `2`
12. `DATAGEN_REGISTER_FAILURE_TTL_SECONDS` default: `86400`

## PoC Scope Decision
For this PoC, registration remains **single-step** and sends generated credentials by email.

Accepted tradeoff:
1. Password is sent in email.

Non-negotiable even for PoC:
1. Never log passwords, tokens, or API keys.
2. Do not persist raw passwords outside `@ratio1/cstore-auth-ts`.
3. Keep auth/session protections unchanged.

## Simplified Target Flow
1. `POST /api/auth/register`
   - Validate `name/email/country`.
   - Normalize email.
   - Apply basic rate limits (IP + email).
   - Check duplicate email via direct email index key.
   - Generate username + random password.
   - Create user in `@ratio1/cstore-auth-ts`.
   - Persist user index + email index in CStore.
   - Send email with username/password.
   - Return success (`username` + user message).
2. `POST /api/auth/register/resend`
   - Re-send credentials for recent failed delivery cases only (rate limited).
   - Keep response generic to reduce enumeration.

## Required Fixes
1. Remove credential logging fallback in [`lib/auth/mailer.ts`](/home/andrei/work/DataGems/lib/auth/mailer.ts).
2. Harden SMTP transport:
   - `secure: port === 465`
   - sane timeout and error handling
3. Replace `O(n)` email lookup with direct index key:
   - add `datagen:user-email-index` (normalizedEmail -> username)
4. Add basic anti-abuse controls on registration:
   - per-IP and per-email window counters
5. Handle partial failures explicitly:
   - if email send fails, return clear retriable error and record failure metadata for resend path
6. Update UI copy to reflect PoC behavior:
   - “Credentials will be emailed to you.”
   - better network error handling in register page

## Data Keys (CStore)
1. `datagen:user-email-index` (hash: normalizedEmail -> username)
2. `datagen:register-mail-failures` (hash: normalizedEmail -> metadata)
3. `datagen:rate:register:ip:{ip}:{window}`
4. `datagen:rate:register:email:{email}:{window}`

## Agent Execution Cards

### Card 0: Baseline
- Goal: Lock baseline behavior before edits.
- Actions:
  - Add/prepare registration-focused tests.
  - Keep existing login/session tests green.
- Acceptance:
  - Current tests pass.
- Rollback:
  - Revert only new test scaffolding.

### Card 1: Mailer Safety
- Goal: Stop secret leaks and stabilize SMTP behavior.
- Actions:
  - Remove password logging.
  - Add secure-port handling and improved error messages.
- Acceptance:
  - No log includes password/token/API key.

### Card 2: Register Route Simplification
- Goal: Keep one-step PoC registration with safer internals.
- Actions:
  - Keep password generation + email send.
  - Add direct email index helpers.
  - Add light rate limiting.
  - Add failure recording for resend support.
- Acceptance:
  - End-to-end register path works with email credential delivery.

### Card 3: Resend Endpoint + UI Tune
- Goal: Provide minimal recovery for delivery failures.
- Actions:
  - Add `/api/auth/register/resend`.
  - Update register page messaging and error handling.
- Acceptance:
  - Failed-delivery cases can be retried.

### Card 4: Hardening + Cleanup
- Goal: Final polish and docs alignment.
- Actions:
  - Redaction audit.
  - Update README/AGENTS if env or endpoint set changed.
- Acceptance:
  - No security regressions in auth-protected routes.

## Tests (Required)

### Unit
1. Mailer config and secure port behavior (`465` vs `587`).
2. Email index helper tests (normalize/read/write).
3. Rate limiter window tests.

### Route/Contract
1. `POST /api/auth/register`
   - valid payload
   - invalid payload
   - duplicate email
   - throttled request
   - email delivery failure path
2. `POST /api/auth/register/resend`
   - valid resend case
   - throttled case
   - generic response for unknown email

### Security
1. Assert no password/token/API key in logs.
2. Assert auth guards unchanged for protected routes.

## Fine-Tuning
1. Tune registration rate limits by environment.
2. Tune resend throttling and retry window.
3. Tune email subject/body for deliverability.
4. Track registration success vs mail failure ratio.

## CRITIC-BUILDER Cycle (per card)

### BUILD
1. Implement one card in a minimal patch.
2. Keep backward compatibility where possible.

### CRITIC (tool-first)
1. `npm run lint`
2. `npm test` (or targeted tests)
3. Route-level checks for changed endpoints
4. Secret leak scan:
   - `rg -n "password=|token=|api[_-]?key|credentials" lib app tests`

### CRITIC (model-assisted)
1. Correctness and edge cases.
2. Failure handling.
3. Maintainability.

### ITERATE
1. Fix only evidence-backed issues.
2. Re-run CRITIC.
3. Log compact reflection:
   - root cause
   - patch
   - prevention note

Stop when:
1. Card acceptance checks pass.
2. No auth regressions.
3. No high-severity untriaged findings.

## Evaluation Reporting
Track for each card and final rollout:
1. `pass@1` on deterministic tests.
2. Regression count.
3. Iteration count to green.
4. Time-to-green.
5. Cost/latency per successful task.

## Definition of Done
1. PoC registration remains one-step and emails credentials.
2. No credential/secret logging remains.
3. Duplicate email lookup is index-based (no full hash scan).
4. Basic rate limiting is active on registration and resend.
5. Resend endpoint works for delivery failures.
6. Test suite passes with new coverage.
