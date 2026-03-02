-- AlterTable: add optional nickname to consent_share_links
ALTER TABLE "consent_share_links" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
