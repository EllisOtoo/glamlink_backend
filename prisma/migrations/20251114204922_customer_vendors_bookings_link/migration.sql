-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "customerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_customerUserId_scheduledStart_idx" ON "Booking"("customerUserId", "scheduledStart");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
