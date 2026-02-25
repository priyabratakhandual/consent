/*
  Warnings:

  - You are about to drop the column `user_id` on the `consents` table. All the data in the column will be lost.
  - Added the required column `tenant_id` to the `consents` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "consents_user_id_idx";

-- AlterTable
ALTER TABLE "consents" DROP COLUMN "user_id",
ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "consents_tenant_id_idx" ON "consents"("tenant_id");
