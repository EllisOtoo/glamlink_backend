-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'MANUAL');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'ONLINE';

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
