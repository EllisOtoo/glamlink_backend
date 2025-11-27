-- CreateTable
CREATE TABLE "SupplySupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "phoneNumber" TEXT,
    "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "leadTimeDays" INTEGER,
    "mediaUrl" TEXT,
    "attributes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "stockRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierCostCents" INTEGER NOT NULL,
    "markupBasisPoints" INTEGER NOT NULL,
    "vendorPriceCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplySupplier_isActive_idx" ON "SupplySupplier"("isActive");

-- CreateIndex
CREATE INDEX "SupplyProduct_supplierId_isActive_idx" ON "SupplyProduct"("supplierId", "isActive");

-- CreateIndex
CREATE INDEX "SupplyProduct_category_isActive_idx" ON "SupplyProduct"("category", "isActive");

-- CreateIndex
CREATE INDEX "SupplyProduct_inStock_isActive_idx" ON "SupplyProduct"("inStock", "isActive");

-- CreateIndex
CREATE INDEX "SupplyPrice_productId_startsAt_idx" ON "SupplyPrice"("productId", "startsAt");

-- AddForeignKey
ALTER TABLE "SupplyProduct" ADD CONSTRAINT "SupplyProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplySupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyPrice" ADD CONSTRAINT "SupplyPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SupplyProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
