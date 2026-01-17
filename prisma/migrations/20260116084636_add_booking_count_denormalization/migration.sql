-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bookingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "bookingCount" INTEGER NOT NULL DEFAULT 0;
