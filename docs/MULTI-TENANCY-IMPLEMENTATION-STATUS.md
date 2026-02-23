# Multi-Tenancy Implementation Status

## Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|--------|
| **Tenant table** | ✅ Implemented | `prisma/schema.prisma`: `Tenant` (id, name, status, slug, databaseUrl, timestamps) |
| **Tenant configuration table** | ✅ Implemented | `TenantConfiguration` with tenant_id, default_consent_validity_days, retention_policy_days, webhook_url, webhook_secret |
| **Tenant-scoped JWT authentication** | ✅ Implemented | JWT payload can include `tenantId`; login/refresh set it when user has a tenant |
| **Middleware that extracts tenant_id from JWT** | ✅ Implemented | `requireTenant` in `middleware/tenant.js`: uses `req.user.tenantId` or `X-Tenant-Id` header, verifies access, sets `req.tenant`, `req.tenantClient` |
| **Row-level tenant isolation** | ⚠️ Different approach | **Database-per-tenant**: each tenant has its own DB; no `tenant_id` on rows in tenant DB. Isolation is physical (separate DB), not row-level in a shared table. |
| **Base model including tenant_id field** | ❌ Not applicable | Tenant DB models do not have `tenant_id` because the entire DB is tenant-scoped. Master DB has `User.tenantId` and `TenantConfiguration.tenantId`. |
| **Automatic tenant filtering in repository layer** | ❌ Not implemented | No repository layer; controllers use `req.tenantClient` (Prisma for that tenant’s DB) directly. Filtering is implicit (one client = one tenant). |
| **Prevent cross-tenant queries** | ✅ By design | Cross-tenant queries are prevented by using a different Prisma client per tenant (`getTenantClientByTenantId`); no shared tenant table is queried without tenant context. |
| **Models** | ✅ | Master: Tenant, TenantConfiguration, User. Tenant: Consent, ConsentTemplate, ConsentInstance, etc. |
| **Schemas** | ✅ | Prisma schemas in `prisma/schema.prisma` (master) and `prisma/tenant/schema.prisma` (tenant). |
| **Services** | ✅ | `tenant.service.js` (provisionTenant, listTenantsForUser, getTenantForUser), `auth.service.js` (login/register with tenant). |
| **Repositories** | ❌ Not implemented | No dedicated repository layer; services/controllers use Prisma directly. |
| **API endpoints for tenant creation** | ✅ | `POST /api/tenants` (create), `GET /api/tenants` (list), `POST /api/tenants/switch` (switch tenant). |
| **Secure tenant onboarding logic** | ✅ | `provisionTenant`: create DB, run migrations, create Tenant row, optionally link owner (create User or UserTenant depending on schema). |

---

## Schema vs Code Alignment

- **Master schema:** `User` with required `tenantId`, no `UserTenant`. `Tenant.status` is `ACTIVE` (uppercase).
- **Auth and tenant code** have been updated to use `User` and `User.tenantId`: register creates tenant then user; login/refresh use `User`; `requireTenant` and tenant service use `User` and same-email logic for multi-tenant access.

---

## Summary

- **Implemented:** Tenant + TenantConfiguration tables, tenant-scoped JWT, tenant middleware (JWT/header → tenant client), tenant APIs, secure onboarding (provision tenant + DB), and cross-tenant prevention via separate DB per tenant.
- **Not implemented:** Repository layer with automatic tenant filtering (not required when using one DB per tenant), and base model with `tenant_id` in tenant DB (isolation is by DB, not by column).
- **Action required:** Align auth and tenant services/middleware with the current master schema (User with tenantId; no UserTenant).
