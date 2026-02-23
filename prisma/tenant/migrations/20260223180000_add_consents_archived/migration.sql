-- Add archived column to consents for data retention (soft delete)
ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
