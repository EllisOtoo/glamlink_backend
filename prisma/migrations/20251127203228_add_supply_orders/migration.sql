-- CreateEnum
CREATE TYPE "SupplyOrderStatus" AS ENUM ('DRAFT', 'REQUIRES_PAYMENT', 'WAITING_ON_SUPPLIER', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PaymentIntent" ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "status" "SupplyOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentIntentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "leadTimeDays" INTEGER,
    "quantity" INTEGER NOT NULL,
    "vendorPriceCents" INTEGER NOT NULL,
    "supplierCostCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "SupplyOrderStatus",
    "toStatus" "SupplyOrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrder_paymentIntentId_key" ON "SupplyOrder"("paymentIntentId");

-- CreateIndex
CREATE INDEX "SupplyOrder_vendorId_status_idx" ON "SupplyOrder"("vendorId", "status");

-- CreateIndex
CREATE INDEX "SupplyOrderStatusHistory_orderId_idx" ON "SupplyOrderStatusHistory"("orderId");

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SupplyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderStatusHistory" ADD CONSTRAINT "SupplyOrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
