# How many applications created by John Doe — process and steps

User and tenant info live in **master**; applications live in **tenant** DB. So you use master to find the user and his tenant(s), then query each tenant DB for counts.

---

## Temporary / sample data

### Master DB

**users**

| id   | email              | name     |
|------|--------------------|----------|
| U-John | john.doe@acme.com | John Doe |
| U-Jane | jane@acme.com     | Jane     |

**tenants**

| id   | name     | database_url (tenant DB name) |
|------|----------|------------------------------|
| T-Acme | Acme Corp | postgresql://.../tenant_acme  |
| T-Beta | Beta Inc  | postgresql://.../tenant_beta  |

**user_tenants**

| user_id | tenant_id |
|---------|-----------|
| U-John  | T-Acme    |
| U-John  | T-Beta    |
| U-Jane  | T-Acme    |

### Tenant DB: tenant_acme (applications)

| id | user_id | name        |
|----|---------|-------------|
| 1  | U-John  | App Alpha   |
| 2  | U-John  | App Beta    |
| 3  | U-Jane  | App Gamma   |

### Tenant DB: tenant_beta (applications)

| id | user_id | name     |
|----|---------|----------|
| 1  | U-John  | App One  |
| 2  | U-John  | App Two  |

---

## Process and steps

**Goal:** Count how many applications were created by John Doe.

| Step | Where   | What you do | Example with sample data |
|------|---------|-------------|---------------------------|
| **1** | Master | Find John Doe’s user id (by name or email). | Look in **users**: John Doe → id = **U-John**. |
| **2** | Master | Find all tenants John belongs to and their DBs. | Look in **user_tenants** for user_id = U-John → tenant_id = T-Acme and T-Beta. From **tenants**: T-Acme → DB `tenant_acme`, T-Beta → DB `tenant_beta`. |
| **3** | Tenant DBs | In **each** of those tenant DBs, count rows in **applications** where `user_id` = John’s id. | In **tenant_acme**: applications where user_id = U-John → **2**. In **tenant_beta**: applications where user_id = U-John → **2**. |
| **4** | - | Add the counts from all tenant DBs. | 2 + 2 = **4** applications created by John Doe. |

---

## Summary

1. **Master:** Get John Doe’s id from **users**.
2. **Master:** Get his tenant(s) from **user_tenants** and their DB from **tenants**.
3. **Tenant:** For each of those DBs, count **applications** where `user_id` = John’s id.
4. **Total:** Sum those counts → total applications created by John Doe.

You need both master (user + tenant list) and each tenant DB (applications), so it’s always at least two places: master first, then each tenant DB.

---

## How to write the queries

### 1. Master DB – get John Doe’s user id

Run against the **master** database:

```sql
-- By name
SELECT id FROM users WHERE name = 'John Doe';

-- Or by email
SELECT id FROM users WHERE email = 'john.doe@acme.com';
```

Example result: `id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` (use this in the next steps).

---

### 2. Master DB – get all tenant DBs for that user

Run against the **master** database (replace `:user_id` with the id from step 1):

```sql
SELECT t.id AS tenant_id, t.name AS tenant_name, t.database_url
FROM user_tenants ut
JOIN tenants t ON t.id = ut.tenant_id
WHERE ut.user_id = :user_id
  AND t.status = 'active';
```

Example result:

| tenant_id | tenant_name | database_url                    |
|-----------|-------------|----------------------------------|
| T-Acme    | Acme Corp   | postgresql://.../tenant_acme     |
| T-Beta    | Beta Inc    | postgresql://.../tenant_beta     |

You then connect to each `database_url` and run the next query in that tenant DB.

---

### 3. Tenant DB – count applications by that user

Run **in each tenant database** (e.g. connect to `tenant_acme`, then to `tenant_beta`). Use the same `:user_id` from step 1:

```sql
SELECT COUNT(*) AS application_count
FROM applications
WHERE user_id = :user_id;
```

Example: in `tenant_acme` → 2; in `tenant_beta` → 2.

---

### 4. Total count

Add the counts from step 3 for each tenant: e.g. 2 + 2 = **4** applications created by John Doe.

You cannot do step 3 in the master DB; `applications` exists only in each tenant DB.

---

## One query per tenant (with tenant name from master)

If you run step 2 first and get a list of tenant `database_url`s, you can run this **in each tenant DB** to get both count and (if you pass it) tenant name:

```sql
-- In tenant DB (e.g. tenant_acme). Replace :user_id with John's id.
SELECT COUNT(*) AS application_count
FROM applications
WHERE user_id = :user_id;
```

Then in your app or a script you sum the results and optionally attach the tenant name from step 2.

---

## Prisma (Node) – same logic

```javascript
// 1) Master: get user id
const user = await masterDb.user.findFirst({
  where: { name: 'John Doe' },  // or { email: 'john.doe@acme.com' }
});
if (!user) return { total: 0 };

// 2) Master: get user's tenants
const userTenants = await masterDb.userTenant.findMany({
  where: { userId: user.id },
  include: { tenant: true },
});
const activeTenants = userTenants.filter(ut => ut.tenant.status === 'active');

// 3) For each tenant DB: count applications
let total = 0;
for (const { tenant } of activeTenants) {
  const tenantClient = await getTenantClientByTenantId(masterDb, tenant.id);
  const count = await tenantClient.application.count({
    where: { userId: user.id },
  });
  total += count;
}
// total = applications created by John Doe
```
