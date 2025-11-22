-- CreateEnum
CREATE TYPE "BookingCancelActor" AS ENUM ('CUSTOMER', 'VENDOR', 'SYSTEM');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledBy" "BookingCancelActor",
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3);
