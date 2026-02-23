-- Step 1: Add new columns to users (nullable/default so existing rows are valid)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'TENANT_ADMIN';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Step 2: Backfill tenant_id from user_tenants (each user gets their first linked tenant)
UPDATE "users" u
SET "tenant_id" = (
  SELECT ut."tenant_id"
  FROM "user_tenants" ut
  WHERE ut."user_id" = u."id"
  LIMIT 1
)
WHERE u."tenant_id" IS NULL;

-- Step 3: If any user has no user_tenants row, assign first tenant in the system
UPDATE "users"
SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1)
WHERE "tenant_id" IS NULL;

-- Step 4: Enforce NOT NULL and FK for tenant_id
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Replace unique email with unique (tenant_id, email)
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- Step 6: Remove old columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "name";
ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_at";

-- Step 7: Drop user_tenants (no longer used)
DROP TABLE IF EXISTS "user_tenants";

-- Step 8: Tenant table updates (database_url nullable, status uppercase for new rows)
ALTER TABLE "tenants" ALTER COLUMN "database_url" DROP NOT NULL;
ALTER TABLE "tenants" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
UPDATE "tenants" SET "status" = 'ACTIVE' WHERE "status" = 'active';

-- Step 9: Create tenant_configurations if not exists
CREATE TABLE IF NOT EXISTS "tenant_configurations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "default_consent_validity_days" INTEGER,
    "retention_policy_days" INTEGER,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_configurations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_configurations_tenant_id_key" ON "tenant_configurations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "tenant_configurations" ADD CONSTRAINT "tenant_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 10: Create templates if not exists
CREATE TABLE IF NOT EXISTS "templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);
