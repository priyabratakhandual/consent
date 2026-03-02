-- AlterTable: add optional subtitle and image to templates; make content optional
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "templates" ALTER COLUMN "content" DROP NOT NULL;
