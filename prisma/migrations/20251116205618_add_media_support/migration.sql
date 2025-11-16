-- Add logo media metadata to vendors.
ALTER TABLE "Vendor"
ADD COLUMN "logoStorageKey" TEXT,
ADD COLUMN "logoVersion" INTEGER NOT NULL DEFAULT 0;

-- Add service image gallery table.
CREATE TABLE "ServiceImage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceImage"
ADD CONSTRAINT "ServiceImage_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ServiceImage_serviceId_idx" ON "ServiceImage"("serviceId");
