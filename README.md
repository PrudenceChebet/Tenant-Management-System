# Tenant Management System (TMS)

A mobile-based distributed tenant management system with AI-assisted priority recommendation for maintenance requests.

| Folder | What it is | Status |
|---|---|---|
| `server/` | Node.js + Express API, Prisma, MySQL | Steps 1 and 2 done: database, login, maintenance request API |
| `client/` | React + Tailwind PWA | Step 3 done: tenant and landlord screens, offline reporting |
| `ai-service/` | Python + FastAPI priority model | Not started |

## What you need installed

- **Node.js 22.18 or newer** (the current LTS is fine): https://nodejs.org
- **MySQL 8**: MySQL Community Server, or XAMPP (it ships MariaDB, which also works)
- **Git**
- Python 3.11+ (only needed later for the AI service)

## Running the server (step 1)

```bash
cd server
npm install                  # also generates the Prisma client
cp .env.example .env         # then edit DATABASE_URL with your MySQL password
```

Create an empty database called `tms` in MySQL (Workbench, phpMyAdmin or `CREATE DATABASE tms;`), then:

```bash
npx prisma migrate dev --name init   # creates all the tables
npm run db:seed                      # adds demo data
npm run dev                          # starts the API on http://localhost:4000
```

Open http://localhost:4000/api/health. You should see:

```json
{ "status": "ok", "database": "connected", "users": 4, "requests": 4 }
```

`npm run db:studio` opens Prisma Studio in the browser so you can look at the tables.

### Demo accounts (password for all: `Password123`)

| Role | Email |
|---|---|
| Landlord | landlord@tms.test |
| Tenant (A1) | brian@tms.test |
| Tenant (A2) | faith@tms.test |
| Tenant (B1) | kevin@tms.test |

## Step 2: login and the request API

All endpoints are under `http://localhost:4000/api`. Except for register, login and health, every request needs the header `Authorization: Bearer <token>`, using the token from login.

| Method | Path | Who | What it does |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create an account (`TENANT` or `LANDLORD`) |
| POST | `/auth/login` | anyone | Returns a token and the user |
| GET | `/auth/me` | logged in | Your account and your unit |
| POST | `/requests` | tenant | Report a problem. Priority is set automatically |
| GET | `/requests` | both | Tenants see their own, landlords see their properties'. Open first, then HIGH, MEDIUM, LOW |
| GET | `/requests/:id` | both | One request with its status timeline and overrides |
| PATCH | `/requests/:id/status` | landlord (tenant can only cancel) | SUBMITTED, ASSIGNED, IN_PROGRESS, RESOLVED, or CANCELLED |
| PATCH | `/requests/:id/priority` | landlord | Override the priority. Logged for retraining |
| GET | `/properties` | landlord | Properties with their units and tenants |
| POST | `/properties` | landlord | Add a property |
| POST | `/properties/:id/units` | landlord | Add a unit |
| PUT | `/units/:id/tenant` | landlord | Link a tenant to a unit by email (or `null` to make it vacant) |

**How the priority is set:** the API asks the AI service (step 4). If it doesn't answer within 3 seconds, or isn't running, the API uses keyword rules instead (see `server/src/services/priority.js`) and saves `prioritySource: "RULE"`. A request is never blocked because the AI is down.

### Trying it with Postman

Import `docs/TMS-API.postman_collection.json` into Postman. Run **Login as tenant** and **Login as landlord** first; they save the tokens for the other requests.

### Automated tests

```bash
npm test             # priority rules and AI fallback (no database needed)
npm run test:api     # full API test; needs the server running and fresh seed data
npm run db:seed      # run again afterwards to reset the demo data
```

## Step 3: the app (React PWA)

You need **two terminals**: one for the API, one for the app.

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm install        # first time only
npm run dev
```

Open http://localhost:5173 and use the demo account buttons on the login screen.

**Tenant:** report an issue (type, title, where, description), see open and closed requests, open one to see its priority and a timeline of every status change, cancel it while it is still Submitted.

**Landlord:** queue sorted by priority with counts for High, Medium and Low; filters for Open, New, Closed and All; open a request to assign it, start work, resolve or cancel it (with a note for the tenant) or change its priority; manage properties, units and which tenant lives where.

**Offline reporting:** if the phone has no connection, the report is saved on the phone (IndexedDB) and shown under "Not sent yet". It is sent automatically when the connection returns. Lists refresh every 30 seconds.

**Testing offline and the installable app:** these need the production build, because the service worker only runs there:

```bash
cd client
npm run build
npm run preview    # then open http://localhost:4173
```

In Chrome, open DevTools (F12) → Network → change "No throttling" to **Offline**, then report an issue. Switch back to "No throttling" and watch it send.

**On your phone:** with `npm run dev` running, the terminal shows a `Network:` address like `http://192.168.1.20:5173`. Open it on a phone on the same Wi-Fi (allow Node through the Windows firewall if asked). Installing to the home screen and offline mode need HTTPS, so they only work on the phone once the app is deployed.

Screenshots of every screen are in `docs/screenshots/`.

## Database design

Tables: `User`, `Property`, `Unit`, `MaintenanceRequest`, `RequestPhoto`, `StatusHistory`, `PriorityOverride`. See `server/prisma/schema.prisma` for comments on each field.

Design decisions worth explaining in the report:

- **`clientId` on each request** is a UUID created on the phone. If an offline request is synced twice, the unique index rejects the duplicate. This makes offline sync safe.
- **`aiPriority` and `priority` are separate.** `aiPriority` is what the model said and never changes. `priority` is what is actually used, and `prioritySource` says whether it came from the AI, the keyword fallback rule, or the landlord.
- **`reportedAt` vs `createdAt`.** `reportedAt` is when the tenant pressed submit, `createdAt` is when the server received it. The gap shows how long a request sat in the offline queue.
- **`StatusHistory`** keeps every status change, which gives the tenant a timeline (objective 4).
- **`PriorityOverride`** logs every landlord correction. These become labelled data for retraining the model.
