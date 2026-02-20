# Multi-tenant data model (Prisma + PostgreSQL)

## Overview

- **One master database** – identity (users) and tenant registry (which tenant has which isolated DB).
- **One isolated database per tenant** – all consent (and other tenant-scoped) data for that business.

Business user signs up → we create a **User** in master and automatically create one **Tenant** with its own **PostgreSQL database** and link the user as owner. They can then create consent forms in that tenant’s DB.

---

## Master database (single DB for all tenants)

### `users`

| Column         | Type     | Description                    |
|----------------|----------|--------------------------------|
| id             | uuid     | PK                             |
| email          | string   | Unique, used for login         |
| password_hash  | string   | Bcrypt                         |
| name           | string?  | Display name                   |
| created_at     | datetime |                                |
| updated_at     | datetime |                                |

**Purpose:** Every **business user** who signs up gets one row here. Auth (login/signup) uses only this DB.

### `tenants`

| Column        | Type     | Description                          |
|---------------|----------|--------------------------------------|
| id            | uuid     | PK                                   |
| name          | string   | Display name (e.g. "Acme Corp")      |
| slug          | string   | Unique; used to derive DB name       |
| database_url  | string   | Full PostgreSQL URL to tenant’s DB   |
| status        | string   | e.g. active / suspended              |
| created_at    | datetime |                                      |
| updated_at    | datetime |                                      |

**Purpose:** One row per **tenant (business)**. Each row points to that tenant’s **isolated database** via `database_url`.

### `user_tenants`

| Column     | Type     | Description                |
|------------|----------|----------------------------|
| user_id    | uuid     | FK → users.id              |
| tenant_id  | uuid     | FK → tenants.id            |
| role       | string   | owner / admin / member     |
| created_at | datetime |                            |

**Purpose:** Links **users** to **tenants**. A user can belong to multiple tenants; for “one business user = one business” we give them one tenant (owner) on signup.

---

## Tenant database (one per tenant, same schema in each)

Each tenant has its own PostgreSQL database. The schema is the same in every tenant DB.

### `consents`

| Column     | Type     | Description                          |
|------------|----------|--------------------------------------|
| id         | uuid     | PK                                   |
| user_id    | string   | Master user id (who created it)      |
| type       | string   | e.g. marketing, analytics            |
| granted    | boolean  | Consent granted or denied            |
| metadata   | json?    | Optional extra data                  |
| created_at | datetime |                                      |
| updated_at | datetime |                                      |

**Purpose:** Consent records (consent forms / consent given) for that tenant only. All tenant-scoped data stays in this DB; no other tenant can see it.

---

## Flow (what we implement)

1. **Signup**  
   - Create **User** in master.  
   - **Auto-provision** one **Tenant** for that user: create an **isolated PostgreSQL database**, run tenant migrations, insert **Tenant** row and **UserTenant** (user = owner). Slug is derived from user id (e.g. `biz-<id-prefix>`) so it is unique. The business user can create consent forms right after signup.

2. **Login**  
   - Validate against master **users**; issue JWT (optionally with `tenantId` for the tenant they own).

3. **Create consent form**  
   - Request is scoped to a tenant (JWT or `X-Tenant-Id`).  
   - Resolve that tenant’s DB from master **tenants.database_url**.  
   - Insert into that tenant’s **consents** table only.

So: **one business user → one tenant → one isolated DB → consent forms only in that DB.** Schema and flow are on the right track for a multi-tenant system with isolated databases per tenant.
