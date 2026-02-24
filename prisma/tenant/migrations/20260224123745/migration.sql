/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `consents` table. All the data in the column will be lost.
  - You are about to drop the `applications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_versions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "consent_template_versions" DROP CONSTRAINT "consent_template_versions_template_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_versions" DROP CONSTRAINT "consent_versions_consent_id_fkey";

DROP INDEX IF EXISTS "consents_deleted_at_idx";

-- AlterTable
ALTER TABLE "consents" DROP COLUMN IF EXISTS "deleted_at";

-- DropTable
DROP TABLE "applications";

-- DropTable
DROP TABLE "consent_templates";

-- DropTable
DROP TABLE "consent_versions";

-- CreateTable
CREATE TABLE "consent_forms" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "lifecycle_state" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_share_links" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_share_api_keys" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "consent_share_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_share_links_token_key" ON "consent_share_links"("token");

-- CreateIndex
CREATE INDEX "consent_share_links_template_id_idx" ON "consent_share_links"("template_id");

-- CreateIndex
CREATE INDEX "consent_share_api_keys_link_id_idx" ON "consent_share_api_keys"("link_id");

-- AddForeignKey
ALTER TABLE "consent_template_versions" ADD CONSTRAINT "consent_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consent_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_share_links" ADD CONSTRAINT "consent_share_links_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consent_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_share_api_keys" ADD CONSTRAINT "consent_share_api_keys_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "consent_share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
