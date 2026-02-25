/*
  Warnings:

  - You are about to drop the column `consent_instance_id` on the `consent_acceptances` table. All the data in the column will be lost.
  - You are about to drop the column `consent_instance_id` on the `consent_revocations` table. All the data in the column will be lost.
  - You are about to drop the column `template_id` on the `consent_share_links` table. All the data in the column will be lost.
  - You are about to drop the `audit_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_instances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_template_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `consent_id` to the `consent_acceptances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consent_id` to the `consent_revocations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consent_id` to the `consent_share_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `consents` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "consent_acceptances" DROP CONSTRAINT "consent_acceptances_consent_instance_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_instances" DROP CONSTRAINT "consent_instances_template_version_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_revocations" DROP CONSTRAINT "consent_revocations_consent_instance_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_share_links" DROP CONSTRAINT "consent_share_links_template_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_template_versions" DROP CONSTRAINT "consent_template_versions_template_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_subscription_id_fkey";

-- DropIndex
DROP INDEX "consent_acceptances_consent_instance_id_key";

-- DropIndex
DROP INDEX "consent_share_links_template_id_idx";

-- AlterTable
ALTER TABLE "consent_acceptances" DROP COLUMN "consent_instance_id",
ADD COLUMN     "consent_id" TEXT NOT NULL,
ADD COLUMN     "share_link_id" TEXT;

-- AlterTable
ALTER TABLE "consent_revocations" DROP COLUMN "consent_instance_id",
ADD COLUMN     "consent_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "consent_share_api_keys" ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_limit" INTEGER;

-- AlterTable
ALTER TABLE "consent_share_links" DROP COLUMN "template_id",
ADD COLUMN     "consent_id" TEXT NOT NULL,
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_limit" INTEGER;

-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "granted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "audit_events";

-- DropTable
DROP TABLE "consent_instances";

-- DropTable
DROP TABLE "consent_template_versions";

-- DropTable
DROP TABLE "webhook_events";

-- DropTable
DROP TABLE "webhook_subscriptions";

-- CreateTable
CREATE TABLE "consent_audits" (
    "id" TEXT NOT NULL,
    "consent_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycle_state" TEXT NOT NULL DEFAULT 'DRAFT',
    "expiry_date" TIMESTAMP(3),

    CONSTRAINT "consent_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_acceptances_consent_id_idx" ON "consent_acceptances"("consent_id");

-- CreateIndex
CREATE INDEX "consent_acceptances_share_link_id_idx" ON "consent_acceptances"("share_link_id");

-- CreateIndex
CREATE INDEX "consent_revocations_consent_id_idx" ON "consent_revocations"("consent_id");

-- CreateIndex
CREATE INDEX "consent_share_links_consent_id_idx" ON "consent_share_links"("consent_id");

-- CreateIndex
CREATE INDEX "consent_share_links_token_idx" ON "consent_share_links"("token");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE INDEX "consents_deleted_at_idx" ON "consents"("deleted_at");

-- AddForeignKey
ALTER TABLE "consent_audits" ADD CONSTRAINT "consent_audits_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_acceptances" ADD CONSTRAINT "consent_acceptances_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_acceptances" ADD CONSTRAINT "consent_acceptances_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "consent_share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_revocations" ADD CONSTRAINT "consent_revocations_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_share_links" ADD CONSTRAINT "consent_share_links_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
