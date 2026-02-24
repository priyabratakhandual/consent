-- CreateTable: immutable consent versions (version control per consent)
CREATE TABLE "consent_versions" (
    "id" TEXT NOT NULL,
    "consent_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_versions_consent_id_version_number_key" ON "consent_versions"("consent_id", "version_number");
CREATE INDEX "consent_versions_consent_id_idx" ON "consent_versions"("consent_id");
CREATE INDEX "consent_versions_user_id_idx" ON "consent_versions"("user_id");

ALTER TABLE "consent_versions" ADD CONSTRAINT "consent_versions_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
