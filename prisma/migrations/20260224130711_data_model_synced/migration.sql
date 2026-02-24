/*
  Warnings:

  - You are about to drop the `tenant_configurations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "tenant_configurations" DROP CONSTRAINT "tenant_configurations_tenant_id_fkey";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "default_consent_validity_days" INTEGER,
ADD COLUMN     "retention_policy_days" INTEGER,
ADD COLUMN     "webhook_secret" TEXT,
ADD COLUMN     "webhook_url" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- DropTable
DROP TABLE "tenant_configurations";
