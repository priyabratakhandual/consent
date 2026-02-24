-- Soft delete: add deleted_at to consents
ALTER TABLE "consents" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "consents_deleted_at_idx" ON "consents"("deleted_at");
