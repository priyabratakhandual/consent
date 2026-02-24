-- Ensure tables exist (they may be created in a later migration in history; for shadow DB we create here)
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

CREATE TABLE IF NOT EXISTS "templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "templates" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "tenant_configurations" ALTER COLUMN "updated_at" DROP DEFAULT;
