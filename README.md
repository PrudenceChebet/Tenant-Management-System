# Tenant Management System (TMS)

A mobile-based distributed tenant management system with AI-assisted priority recommendation for maintenance requests.

| Folder | What it is | Status |
|---|---|---|
| `server/` | Node.js + Express API, Prisma, MySQL | Step 1 done: database schema, seed data, health check |
| `client/` | React + Tailwind PWA | Not started |
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

## Database design

Tables: `User`, `Property`, `Unit`, `MaintenanceRequest`, `RequestPhoto`, `StatusHistory`, `PriorityOverride`. See `server/prisma/schema.prisma` for comments on each field.

Design decisions worth explaining in the report:

- **`clientId` on each request** is a UUID created on the phone. If an offline request is synced twice, the unique index rejects the duplicate. This makes offline sync safe.
- **`aiPriority` and `priority` are separate.** `aiPriority` is what the model said and never changes. `priority` is what is actually used, and `prioritySource` says whether it came from the AI, the keyword fallback rule, or the landlord.
- **`reportedAt` vs `createdAt`.** `reportedAt` is when the tenant pressed submit, `createdAt` is when the server received it. The gap shows how long a request sat in the offline queue.
- **`StatusHistory`** keeps every status change, which gives the tenant a timeline (objective 4).
- **`PriorityOverride`** logs every landlord correction. These become labelled data for retraining the model.
