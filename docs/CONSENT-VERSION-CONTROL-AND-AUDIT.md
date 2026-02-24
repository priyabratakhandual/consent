# Consent Version Control and Audit

## Overview

Version control and audit are implemented for **every consent action** (create and update) so that:

- **Immutable consent versions** – Each create/update produces a new row in `consent_versions`; previous states are never overwritten.
- **Version tracking per user** – Versions are tied to the consent and its `userId`; `changedBy` records who made the change (null on create).
- **Audit of changes** – Every action is written to `audit_events` with old/new data and a hash chain for integrity.

## Tables (Tenant DB)

| Table | Purpose |
|------|--------|
| **consents** | Current state of each consent (legacy API). |
| **consent_versions** | Immutable snapshots: one row per create (v1) and per update (v2, v3, …). Columns: consent_id, version_number, user_id, type, granted, metadata, changed_by, created_at. |
| **audit_events** | Audit log: entity_type CONSENT, entity_id, action (CONSENT_CREATED / CONSENT_UPDATED), performed_by, old_data, new_data, ip_address, hash, previous_hash (chain). |

Existing tenant schema already had `consent_templates`, `consent_template_versions`, `consent_instances`, and `audit_events`. Added:

- **ConsentVersion** model and **consent_versions** table (migration `20260224120000_add_consent_versions`).

No change to **audit_events** structure; it was already present and used as-is.

## When It Runs

- **Create consent** (`POST /api/consents`): Creates consent → creates `ConsentVersion` (version 1) → writes `AuditEvent` (CONSENT_CREATED, newData).
- **Update consent** (`PATCH /api/consents/:id`): Updates consent → creates next `ConsentVersion` (version N+1, changedBy = current user) → writes `AuditEvent` (CONSENT_UPDATED, oldData + newData).

## API

- **GET /api/consents/:id/versions** – Returns version history for a consent (ordered by version_number desc). Requires auth and tenant context.

## Applying the Migration

Run tenant migrations so `consent_versions` exists in each tenant DB:

```bash
npm run prisma:migrate:tenant
```

If you use separate DBs per tenant, run the same migration (or the generated SQL) against each tenant database.

## Audit Hash Chain

Each audit row has:

- **hash** – SHA-256(previousHash + JSON payload of this event).
- **previous_hash** – Hash of the previous audit event (any entity) in the same tenant DB; null for the first event.

This supports verifying that the audit log has not been altered out of order.

## Template-Level Versioning (Future)

The tenant schema already has **ConsentTemplate** and **ConsentTemplateVersion** for formal template lifecycle (DRAFT → PUBLISHED, immutable versions). The current implementation versions the **legacy Consent** records (create/update via API). When you add APIs that create or update **ConsentTemplate** or **ConsentTemplateVersion**, you can reuse the same audit service (`recordConsentAudit` or a dedicated `recordTemplateAudit`) with entityType `TEMPLATE` or `TEMPLATE_VERSION` and the same hash chain.
