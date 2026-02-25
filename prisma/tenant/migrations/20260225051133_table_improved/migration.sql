/*
  Warnings:

  - You are about to drop the column `granted` on the `consents` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `consents` table. All the data in the column will be lost.
  - You are about to drop the `consent_forms` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `consents` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "consent_share_links" DROP CONSTRAINT "consent_share_links_template_id_fkey";

-- DropForeignKey
ALTER TABLE "consent_template_versions" DROP CONSTRAINT "consent_template_versions_template_id_fkey";

-- AlterTable
ALTER TABLE "consents" DROP COLUMN "granted",
DROP COLUMN "user_id",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "lifecycle_state" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "template_id" TEXT;

-- DropTable
DROP TABLE "consent_forms";

-- AddForeignKey
ALTER TABLE "consent_template_versions" ADD CONSTRAINT "consent_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_share_links" ADD CONSTRAINT "consent_share_links_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
