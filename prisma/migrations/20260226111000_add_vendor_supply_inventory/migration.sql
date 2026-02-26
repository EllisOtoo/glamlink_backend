-- CreateTable
CREATE TABLE "VendorSupplyInventory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSupplyInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorSupplyInventory_vendorId_productId_key" ON "VendorSupplyInventory"("vendorId", "productId");

-- CreateIndex
CREATE INDEX "VendorSupplyInventory_vendorId_updatedAt_idx" ON "VendorSupplyInventory"("vendorId", "updatedAt");

-- CreateIndex
CREATE INDEX "VendorSupplyInventory_productId_idx" ON "VendorSupplyInventory"("productId");

-- AddForeignKey
ALTER TABLE "VendorSupplyInventory" ADD CONSTRAINT "VendorSupplyInventory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSupplyInventory" ADD CONSTRAINT "VendorSupplyInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SupplyProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
