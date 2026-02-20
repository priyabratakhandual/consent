# New tenant creation – how the process works

When a **new tenant** is created (e.g. "Acme Corp"), the system creates a **new database** for that tenant and links the creating user as owner. Here is the step-by-step process.

---

## Who can create a tenant?

- Only a **logged-in user** (valid JWT).
- Request: `POST /api/tenants` with header `Authorization: Bearer <access_token>` and body `{ "name": "Acme Corp", "slug": "acme-corp" }`.

---

## Process step by step

| Step | What happens | Where / How |
|------|----------------|-------------|
| **1** | Request arrives | `POST /api/tenants` with JWT and body `{ name, slug }`. |
| **2** | Auth | Middleware checks JWT → `req.user.sub` = user id (e.g. John’s id). |
| **3** | Validation | Check `name` and `slug` present; `slug` normalized (lowercase, hyphens, no spaces). |
| **4** | Slug uniqueness | Master DB: check no existing tenant with same `slug`. If exists → 409 Conflict. |
| **5** | Create new PostgreSQL DB | Connect to PostgreSQL (default `postgres` DB), run `CREATE DATABASE "tenant_<slug>"` (e.g. `tenant_acme_corp`). |
| **6** | Build tenant DB URL | New DB URL = same host/user/pass as master, database name = `tenant_<slug>`. |
| **7** | Run tenant migrations | Run `prisma migrate deploy` against that URL → creates tables in the new DB (e.g. `applications`, `consents`). |
| **8** | Save tenant in master | Master DB: insert into **tenants** (`id`, `name`, `slug`, `database_url`, `status = 'active'`). |
| **9** | Link user as owner | Master DB: insert into **user_tenants** (`user_id` = creator, `tenant_id` = new tenant, `role = 'owner'`). |
| **10** | Response | Return 201 with tenant `id`, `name`, `slug`, `status` (and optionally `database_url`). |

---

## Flow diagram

```
User (already logged in) → POST /api/tenants { name: "Acme Corp", slug: "acme-corp" }
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 1. Auth (JWT) → get user id   │
                    │ 2. Validate name, slug        │
                    │ 3. Master: slug unique?        │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 4. CREATE DATABASE             │
                    │    "tenant_acme_corp"         │
                    │    (on same PostgreSQL server) │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 5. Prisma migrate deploy       │
                    │    on new DB → applications,   │
                    │    consents tables, etc.       │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 6. Master DB:                  │
                    │    INSERT tenants              │
                    │    (id, name, slug,            │
                    │     database_url, status)      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 7. Master DB:                  │
                    │    INSERT user_tenants         │
                    │    (user_id, tenant_id,        │
                    │     role = 'owner')            │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                         Response 201 + tenant data
```

---

## What exists after a new tenant is created

| Place | What was added |
|-------|----------------|
| **PostgreSQL server** | A **new database** (e.g. `tenant_acme_corp`) with tenant schema (e.g. `applications`, `consents`). |
| **Master DB – tenants** | One row: `id`, `name`, `slug`, `database_url` (pointing to that new DB), `status = 'active'`. |
| **Master DB – user_tenants** | One row: creating user’s `user_id`, new `tenant_id`, `role = 'owner'`. |

The creating user can now:
- Call tenant-scoped APIs with `X-Tenant-Id: <new_tenant_id>` (or get a new token with that `tenantId`).
- Create applications, consents, etc. in that tenant’s DB.

---

## Summary

1. **Request:** Logged-in user sends `POST /api/tenants` with `name` and `slug`.
2. **New DB:** System creates a new PostgreSQL database `tenant_<slug>` and runs migrations on it.
3. **Master:** One new row in **tenants** (with `database_url`) and one in **user_tenants** (user as owner).
4. **Result:** Tenant has its own isolated DB; all feature data for that tenant goes into that DB.

No new **user** is created; the same user who called the API becomes the **owner** of the new tenant and its database.
