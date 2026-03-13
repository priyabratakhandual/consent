-- AlterTable
ALTER TABLE "consent_acceptances" ADD COLUMN     "consent_signer_id" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "consent_revocations" ADD COLUMN     "acceptance_id" TEXT,
ADD COLUMN     "consent_signer_id" TEXT,
ADD COLUMN     "revoked_by_type" TEXT NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "consent_signers" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_signers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_signers_email_idx" ON "consent_signers"("email");

-- CreateIndex
CREATE INDEX "consent_signers_phone_idx" ON "consent_signers"("phone");

-- CreateIndex
CREATE INDEX "consent_acceptances_consent_signer_id_idx" ON "consent_acceptances"("consent_signer_id");

-- CreateIndex
CREATE INDEX "consent_acceptances_status_idx" ON "consent_acceptances"("status");

-- CreateIndex
CREATE INDEX "consent_revocations_acceptance_id_idx" ON "consent_revocations"("acceptance_id");

-- AddForeignKey
ALTER TABLE "consent_acceptances" ADD CONSTRAINT "consent_acceptances_consent_signer_id_fkey" FOREIGN KEY ("consent_signer_id") REFERENCES "consent_signers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_revocations" ADD CONSTRAINT "consent_revocations_acceptance_id_fkey" FOREIGN KEY ("acceptance_id") REFERENCES "consent_acceptances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_revocations" ADD CONSTRAINT "consent_revocations_consent_signer_id_fkey" FOREIGN KEY ("consent_signer_id") REFERENCES "consent_signers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
