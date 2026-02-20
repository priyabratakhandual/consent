# Consent Management – Backend API

Node.js (Express) API with **Prisma**, **PostgreSQL**, **multi-tenancy** (master DB for auth + isolated DB per tenant), logging, security, and JWT auth.

## Features

- **Prisma + PostgreSQL**: Master database for users/tenants; separate PostgreSQL database per tenant (isolated data).

- **Multi-tenancy**: Login/signup against master; each tenant has its own DB. Create tenant → new DB is provisioned and migrated.

- **Logging**: Winston with request logging and optional file transport in production.

- **Security**: Helmet, CORS, rate limiting, request sanitization.

- **Auth**: JWT access + refresh, bcrypt, register / login / refresh / me; optional `tenantId` in token and `X-Tenant-Id` header for tenant-scoped routes.

- **Error handling**: Central error middleware, `ApiError`, async handler, global exception handlers, graceful shutdown.

## Folder structure

```
prisma/
├── schema.prisma              # Master DB: User, Tenant, UserTenant
├── migrations/
└── tenant/
    ├── schema.prisma          # Tenant DB: Consent (same schema per tenant)
    └── migrations/
src/
├── config/
├── controllers/
├── db/                        # master client, tenant client factory
├── generated/                 # Prisma generated clients (master, tenant)
├── middleware/
├── routes/
├── services/
├── utils/
├── app.js
└── server.js
```

## Setup

**Full step-by-step setup on a new machine (all commands, migrations, run server):** see **[docs/SETUP-NEW-MACHINE.md](docs/SETUP-NEW-MACHINE.md)**.

Quick outline:

1. **PostgreSQL**: Create a database for the master (e.g. `consent_master`). Tenant DBs are created automatically when you create a tenant.

2. **Env**:
   ```bash
   cp .env.example .env
   # Set MASTER_DATABASE_URL and TENANT_DATABASE_URL (tenant URL used for migrate deploy; can point to same server, different DB)
   ```

3. **Install and generate**:
   ```bash
   npm install
   npm run prisma:generate
   ```

4. **Migrations** (run once per DB type):
   ```bash
   # Master DB (auth + tenants)
   npm run prisma:migrate:master

   # Tenant schema (used for every new tenant DB)
   npm run prisma:migrate:tenant
   ```
   For `prisma:migrate:tenant`, `TENANT_DATABASE_URL` can point to any existing PostgreSQL DB (e.g. a dummy `tenant_default`); this only creates the migration history. New tenant DBs get the same schema via `migrate deploy` when the tenant is provisioned.

## Run

```bash
npm run dev   # or npm start
```

## API

- **Health**: `GET /api/health`

- **Auth** (master DB):
  - `POST /api/auth/register` – body: `email`, `password`, optional `name`
  - `POST /api/auth/login` – body: `email`, `password`, optional `tenantId`
  - `POST /api/auth/refresh` – body: `refreshToken` or header `x-refresh-token`, optional `tenantId`
  - `GET /api/auth/me` – header: `Authorization: Bearer <accessToken>`

- **Tenants** (auth required):
  - `POST /api/tenants` – create tenant (body: `name`, `slug`). Creates new PostgreSQL DB and links you as owner.
  - `GET /api/tenants` – list tenants you belong to
  - `POST /api/tenants/switch` – body: `tenantId`, optional `refreshToken` → new access token with that tenant

- **Consents** (auth + tenant required; use `X-Tenant-Id` or token with `tenantId`):
  - `GET /api/consents` – list consents in current tenant DB
  - `POST /api/consents` – create consent in current tenant DB (body: `type`, optional `userId`, `granted`, `metadata`)

## How the data fits together (example: John Doe)

- **Master DB** holds:
  - **users** – one row per user (e.g. John Doe: id, email, password_hash, name).
  - **tenants** – one row per tenant; each row has a **column with that tenant’s DB** (`database_url`, and logically the DB name is `tenant_<slug>`).
  - **user_tenants** – links users to tenants (John Doe ↔ which tenant(s) he belongs to).

- **Tenant DB** (the database pointed to by `tenants.database_url` for John’s tenant):
  - All **feature data for that tenant** lives here (e.g. consents, or any other tenant-scoped tables).
  - So everything “related to John Doe” for that tenant (his consents, preferences, etc.) is stored in **that tenant’s DB**, not in master.

Flow for a request as John Doe:

1. **Auth** – John logs in; we look up **users** in **master** and issue a JWT (optionally with `tenantId`).
2. **Tenant context** – We know John’s tenant from **user_tenants** in master; that row points to **tenants**, which has the **tenant DB name/URL** (`database_url`).
3. **Feature data** – For routes that need John’s data (e.g. consents), we use that URL to connect to **his tenant’s DB** and read/write only there.

So: **identity and tenant membership live in master**; **all feature data for that user in that tenant lives in the tenant DB**.

## Multi-tenancy flow

1. **Register / Login** → user lives in **master** DB only; token may include `tenantId` if user has a tenant.
2. **Create tenant** (`POST /api/tenants`) → new PostgreSQL DB is created, migrations run, Tenant row (with `database_url`) and UserTenant (you as owner) stored in master.

3. **Tenant-scoped requests** → send `Authorization: Bearer <token>` and `X-Tenant-Id: <tenantId>`. Middleware resolves tenant DB from master (`user_tenants` → `tenants.database_url`) and attaches `req.tenantClient` (Prisma client for that tenant’s DB).

4. **Switch tenant** → `POST /api/tenants/switch` with `tenantId` and `refreshToken` returns a new access token with that `tenantId` so you can omit `X-Tenant-Id` for subsequent requests.

## Environment variables

See `.env.example`. Required: `MASTER_DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. Optional: `TENANT_DATABASE_URL` (for running tenant migrations locally), `PORT`, `NODE_ENV`, `CORS_ORIGIN`, etc.
