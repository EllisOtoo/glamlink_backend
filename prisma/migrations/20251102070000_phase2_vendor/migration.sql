-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Vendor"
  ADD COLUMN     "bio" TEXT,
  ADD COLUMN     "contactEmail" TEXT,
  ADD COLUMN     "instagramHandle" TEXT,
  ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3),
  ADD COLUMN     "locationArea" TEXT,
  ADD COLUMN     "phoneNumber" TEXT,
  ADD COLUMN     "rejectionReason" TEXT,
  ADD COLUMN     "reviewedById" TEXT,
  ADD COLUMN     "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN     "verifiedAt" TIMESTAMP(3),
  ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorStatusHistory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fromStatus" "VendorStatus",
    "toStatus" "VendorStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "KycDocument_vendorId_idx" ON "KycDocument"("vendorId");

-- CreateIndex
CREATE INDEX "VendorStatusHistory_vendorId_idx" ON "VendorStatusHistory"("vendorId");

-- CreateIndex
CREATE INDEX "VendorStatusHistory_actorId_idx" ON "VendorStatusHistory"("actorId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorStatusHistory" ADD CONSTRAINT "VendorStatusHistory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorStatusHistory" ADD CONSTRAINT "VendorStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
