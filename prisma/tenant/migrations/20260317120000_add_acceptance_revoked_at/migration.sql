-- AlterTable: add revoked_at to consent_acceptances for immediate status update
ALTER TABLE "consent_acceptances" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3);
