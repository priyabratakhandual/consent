-- CreateTable
CREATE TABLE "share_link_registry" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_link_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_link_registry_token_key" ON "share_link_registry"("token");

-- CreateIndex
CREATE INDEX "share_link_registry_token_idx" ON "share_link_registry"("token");

-- AddForeignKey
ALTER TABLE "share_link_registry" ADD CONSTRAINT "share_link_registry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
