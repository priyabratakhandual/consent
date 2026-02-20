# How many applications created by a user (e.g. John Doe)

User lives in **master** DB; applications live in **tenant** DB(s). So you need to:
1. Get the user's id from master (by name or email).
2. Get all tenant DBs that user belongs to (from master).
3. For each tenant DB, count rows in `applications` where `user_id` = that user id.
4. Sum (or return per-tenant).

---

## 1. SQL (raw)

### Step 1 – Master: get John Doe’s user id

```sql
-- In master DB
SELECT id FROM users WHERE name = 'John Doe';
-- Or by email:
SELECT id FROM users WHERE email = 'john.doe@example.com';
-- Example result: id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
```

### Step 2 – Master: get all tenant DB URLs for that user

```sql
-- In master DB (use the user id from step 1)
SELECT t.id AS tenant_id, t.name, t.database_url
FROM user_tenants ut
JOIN tenants t ON t.id = ut.tenant_id
WHERE ut.user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND t.status = 'active';
```

You get one row per tenant; each row has `database_url` (connection to that tenant’s DB).

### Step 3 – Tenant DB: count applications by that user

Run this **in each tenant database** (using the `database_url` from step 2):

```sql
-- In tenant DB (e.g. tenant_acme_corp)
SELECT COUNT(*) AS application_count
FROM applications
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### Total count

- If the user has only one tenant: the result of step 3 is the total.
- If the user has multiple tenants: run step 3 once per tenant and **add** the counts to get total applications created by John Doe.

---

## 2. Prisma / Node (in your app)

Same idea: resolve user in master, get tenant DBs from master, then use the tenant client to count.

```js
import masterDb from '../db/master.js';
import { getTenantClientByTenantId } from '../db/tenant.js';

/**
 * Total number of applications created by a user (by name or email).
 * Uses master for user + tenant list, then each tenant DB for counts.
 */
async function getApplicationCountByUserName(userIdentifier) {
  // 1) Master: get user id (by name or email)
  const user = await masterDb.user.findFirst({
    where: {
      OR: [
        { name: userIdentifier },
        { email: userIdentifier },
      ],
    },
  });
  if (!user) return { total: 0, byTenant: [] };

  // 2) Master: get all tenants this user belongs to
  const userTenants = await masterDb.userTenant.findMany({
    where: { userId: user.id },
    include: { tenant: true },
  });
  const activeTenants = userTenants.filter((ut) => ut.tenant.status === 'active');

  // 3) For each tenant DB: count applications where user_id = user.id
  const byTenant = [];
  let total = 0;

  for (const { tenant } of activeTenants) {
    const tenantClient = await getTenantClientByTenantId(masterDb, tenant.id);
    const count = await tenantClient.application.count({
      where: { userId: user.id },
    });
    byTenant.push({ tenantId: tenant.id, tenantName: tenant.name, count });
    total += count;
  }

  return { total, byTenant };
}

// Usage:
// const result = await getApplicationCountByUserName('John Doe');
// console.log(result.total);        // e.g. 7
// console.log(result.byTenant);     // e.g. [{ tenantName: 'Acme', count: 5 }, { tenantName: 'Beta', count: 2 }]
```

---

## Summary

| Step | DB      | What to do |
|------|--------|------------|
| 1    | Master | `users` → get `id` for John Doe (by name/email). |
| 2    | Master | `user_tenants` + `tenants` → get `database_url` (and tenant id/name) for each tenant of that user. |
| 3    | Tenant | For each tenant DB: `SELECT COUNT(*) FROM applications WHERE user_id = :userId`. |
| 4    | -      | Sum the counts = **total applications created by John Doe**. |

You cannot do this in a single SQL query because the data is in two different databases (master vs tenant). The app ties them together using the master `user_id` and the tenant’s `applications.user_id`.
