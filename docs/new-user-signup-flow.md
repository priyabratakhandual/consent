# New user signup – what happens? Is a new database created?

**Short answer:** No. A **new user signup does NOT create a new database**. Only a new **tenant** creates a new database.

---

## What happens when a new user signs up

| Step | What happens | Where |
|------|----------------|------|
| 1 | User submits email, password, (optional) name | Frontend |
| 2 | API creates **one row** in `users` | **Master DB only** |
| 3 | User can log in and call auth APIs (e.g. `/auth/me`) | Master DB |

**No tenant row is created. No `user_tenants` row. No new database.**

After signup the user exists only in the **master** DB. They have no tenant yet, so they cannot use tenant-scoped APIs (e.g. applications, consents) until they either create a tenant or are added to one.

---

## When is a new database created?

A **new tenant database** is created only when someone calls **Create tenant** (e.g. `POST /api/tenants` with `name` and `slug`).

| Step | What happens | Where |
|------|----------------|------|
| 1 | Logged-in user calls Create tenant (e.g. name: "Acme Corp", slug: "acme-corp") | API |
| 2 | System creates a **new PostgreSQL database** (e.g. `tenant_acme_corp`) | Server |
| 3 | Tenant schema (tables like `applications`, `consents`) is applied to that DB | New tenant DB |
| 4 | A row is added in `tenants` (with `database_url` pointing to that DB) | Master DB |
| 5 | A row is added in `user_tenants` (this user as **owner** of that tenant) | Master DB |

So: **new DB = new tenant**, not new user.

---

## Two flows side by side

```
NEW USER SIGNUP
───────────────
  User signs up
       ↓
  Master DB: insert into users (email, password_hash, name)
       ↓
  Done. No new DB. No tenant. User can log in but has no tenant data yet.


NEW TENANT (when a user creates a tenant)
─────────────────────────────────────────
  Logged-in user calls POST /api/tenants { name, slug }
       ↓
  Create new PostgreSQL DB (e.g. tenant_acme_corp)
       ↓
  Run tenant migrations on that DB (applications, consents, etc.)
       ↓
  Master DB: insert into tenants (id, name, slug, database_url, status)
       ↓
  Master DB: insert into user_tenants (user_id, tenant_id, role='owner')
       ↓
  Done. New DB exists. This user is owner of that tenant and can use tenant APIs.
```

---

## Summary

| Action | New user row (master) | New tenant row (master) | New tenant DB |
|--------|------------------------|--------------------------|---------------|
| **User signup** | ✅ Yes | ❌ No | ❌ No |
| **Create tenant** | ❌ No | ✅ Yes | ✅ Yes |
| **Invite user to existing tenant** | ❌ No (user already exists) | ❌ No | ❌ No (only new `user_tenants` row) |

So: **signup = only master `users`**. **New database = only when a new tenant is created.**
