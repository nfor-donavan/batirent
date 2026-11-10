# BatiRent

<p><img src="docs/brand/nexus-logo-light.png" alt="NEXUS Tech Labs" width="120"></p>

**BatiRent is a product of NEXUS Tech Labs.**

Multi-tenant SaaS for construction-equipment rental yards (*quincailleries de location de matériel de chantier*) in Yaoundé, Douala and Kribi. It replaces chalkboards and paper ledgers with a full audit trail of every scaffolding frame, prop and mixer: who has it, since when, what was returned, in what condition (with photos), and what is owed for delays.

| Part | Folder | Stack |
|---|---|---|
| API | `backend/` | Node.js, Express, MongoDB (Mongoose), node-cron, JWT |
| Yard dashboard (web) | `web/` | React + Vite, FR/EN, light/dark |
| Site handover app (Android-first) | `mobile/` | React Native, Expo, camera, offline queue, FR/EN, light/dark |

## What is implemented

**Multi-tenancy.** Every document carries `tenantId`. The tenant is taken from the signed JWT, never from the request, so one yard cannot read another's data. Roles: `owner`, `manager`, `operator` (field staff can only view contracts and record returns).

**Cumulative overdue penalty engine** (`backend/src/services/penalty.js`, pure functions, unit-tested):

```
Daily Overdue Rate = Σ (outstanding quantity × daily rate) × multiplier      (default 1.5)
Exposure           = penaltyBase + calendar days since checkpoint × Daily Overdue Rate
```

Partial returns freeze the penalty accrued so far and lower the daily rate from that moment. Days are counted in Cameroon time. A daily `node-cron` sweep flags contracts `Overdue`, refreshes `currentOverdueExposureXAF` and sends SMS; the dashboard also computes exposure live on every read.

**Condition photo verification** (`POST /api/contracts/:id/returns`, multipart): field operators photograph equipment with the Expo camera; photos are compressed on the phone, stored (Cloudinary or local disk), fingerprinted with SHA-256 and written to an **immutable** `ReturnInspection` record. Damaged returns cannot be submitted without a photo.

**Dashboard:** real-time utilisation ("49% of your equipment is out on sites"), per-category utilisation, warning rings for contracts expiring in 3 days, most costly overdue contracts, deposits held, value at sites, recorded losses, stock integrity check, full audit log, printable contract sheet with statement of account.

### Corrections to the original brief (all implemented)

1. **Contract numbers are unique per yard**, not globally: unique index on `{ tenantId, contractNumber }`, numbers like `BR-YDE-2026-0042` from an atomic per-tenant counter.
2. **No stock drift:** stock is reserved with a conditional atomic update (`available >= qty`) per asset, with rollback if any line fails; returns are guarded by an optimistic-concurrency `rev`. A `/dashboard/integrity` check reconciles stored stock against open contracts (`total = available + deployed + lost/damaged`).
3. **Partial returns** with per-line good / damaged / lost quantities, a separate immutable `ReturnInspection` collection, repair flow (`inRepairQty`) and settlement (rental + penalties + lost items + repair charges − deposit).
4. **Cron resilience on Render:** the sweep is idempotent (SMS markers per contract/day), runs once at every boot as catch-up, and exposure is also computed on read.
5. **Photo storage** goes through Cloudinary (set the three env vars); local disk is only for development.
6. **Added missing pieces:** `Tenant`, `User` (roles), `AuditLog`, `SmsLog`; pluggable SMS provider; offline queue in the mobile app.

## Quick start (local)

Prerequisites: Node 18+, MongoDB (local `mongod`, `docker compose up -d`, or an Atlas URI).

```bash
# 1. API
cd backend
cp .env.example .env            # set MONGODB_URI and JWT_SECRET
npm install
npm run seed                    # wipes the DB and loads the demo (3 yards)
npm run dev                     # http://localhost:4000

# 2. Web dashboard
cd ../web
cp .env.example .env            # VITE_API_URL=http://localhost:4000
npm install
npm run dev                     # http://localhost:5173

# 3. Mobile (Android)
cd ../mobile
npm install
npx expo install --fix          # aligns native module versions with your Expo SDK (if Metro says a package is missing, run: npx expo install expo-asset)
# set the API address in app.json "extra.apiUrl" or type it on the login screen
#   Android emulator -> http://10.0.2.2:4000    real phone -> http://<your-PC-LAN-IP>:4000
npx expo start --android
```

### Demo accounts (password `Demo@2026`)

| Yard | Owner | Manager | Operator |
|---|---|---|---|
| Yaoundé Location Matériel | owner@ylm.batirent.cm | manager@ylm.batirent.cm | operator@ylm.batirent.cm |
| Douala Chantier Pro | owner@dcp.batirent.cm | manager@dcp.batirent.cm | operator@dcp.batirent.cm |
| Kribi Port Équipements | owner@kpe.batirent.cm | manager@kpe.batirent.cm | operator@kpe.batirent.cm |

The seed is generated relative to today's date: overdue contracts, contracts due today/tomorrow, a partial return with damaged frames, a disputed contract, settled history with lost and damaged equipment, SMS history, and photo evidence. Re-run `npm run seed` before a presentation so the dates are fresh. See `docs/DEMO-SCRIPT.md` for a 10-minute walkthrough.

## Branding

The NEXUS Tech Labs logo appears on the login pages (web and mobile), in the web sidebar and in the footer of printed contracts. Every artwork has a light and a dark variant that switches with the theme; the files are in `docs/brand/` (copies in `web/public/brand/` and `mobile/assets/brand/`).

## Tests

```bash
cd backend
npm test                                  # penalty engine, settlement, phone normalisation (no DB needed)
node tests/smoke.integration.js           # against a running, freshly seeded API: tenant isolation, roles,
                                          # oversell + rollback, photo-required rule, partial/final returns, integrity
REAL_MONGO=1 node tests/smoke.integration.js   # also runs the concurrent-booking race (needs real MongoDB/Atlas)
```

## Deployment

* **API → Render:** `render.yaml` is a Blueprint (root dir `backend`). Set `MONGODB_URI` (Atlas), `CORS_ORIGINS`, `PUBLIC_API_URL`, Cloudinary keys. Use a paid instance: free instances sleep and cannot run the daily sweep on time.
* **Web → Vercel:** root dir `web`, build `npm run build`, env `VITE_API_URL=<your Render URL>` (`vercel.json` handles SPA routing).
* **Mobile → APK:** `eas build -p android --profile preview` (set `extra.apiUrl` to the Render URL first).
* **SMS:** `SMS_PROVIDER=console` logs messages (demo mode; they also appear in each contract's SMS panel). For real delivery set `SMS_PROVIDER=webhook` and point `SMS_WEBHOOK_URL` at your gateway; the API posts `{ to, message }` JSON.

## API overview

All routes except `/api/auth/login` and `/health` need `Authorization: Bearer <token>`. Errors look like `{ "error": { "code": "INSUFFICIENT_STOCK", "details": {...} } }`; clients translate the `code` (FR/EN).

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | any | sign in / current user |
| `GET/POST /api/assets`, `PATCH /api/assets/:id`, `POST /api/assets/:id/adjust`, `/repair` | manager+ to write | fleet and stock movements |
| `GET/POST /api/contracts`, `GET /api/contracts/:id` | manager+ to create | contracts, statement of account, inspections, SMS, audit |
| `POST /api/contracts/:id/returns` | any | multipart return with photos (the verification endpoint) |
| `PATCH /api/contracts/:id/dispute`, `/resolve-dispute`, `/damage-charge` | manager+ | disputes and repair charges |
| `GET /api/dashboard/summary`, `/integrity`, `POST /api/dashboard/run-sweep` | manager+ / owner | KPIs, stock reconciliation, manual sweep |
| `GET /api/audit`, `/api/inspections`, `GET/PATCH /api/tenant`, `/api/users` | manager+ / owner | audit trail, settings, team |

## Known limits and next steps

* The mobile app was syntax-checked and its dependencies resolved, but it has **not been run on a device or emulator** in this build environment: test it on your phone before presenting, and run `npx expo install --fix` first.
* The concurrent-booking guarantee relies on MongoDB's single-document atomicity; it is covered by `REAL_MONGO=1` smoke test, which needs a real MongoDB or Atlas.
* Not yet built: contract extensions/renewals, online payment of balances, PDF contract export (the print view covers it for now), push notifications, per-asset serial numbers, and automated UI tests.
