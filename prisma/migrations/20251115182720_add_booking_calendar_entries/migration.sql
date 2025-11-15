-- CreateEnum
CREATE TYPE "CalendarOwnerType" AS ENUM ('VENDOR', 'CUSTOMER');

-- CreateTable
CREATE TABLE "BookingCalendarEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ownerType" "CalendarOwnerType" NOT NULL,
    "vendorId" TEXT,
    "customerUserId" TEXT,
    "serviceId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingCalendarEntry_vendorId_scheduledStart_idx" ON "BookingCalendarEntry"("vendorId", "scheduledStart");

-- CreateIndex
CREATE INDEX "BookingCalendarEntry_customerUserId_scheduledStart_idx" ON "BookingCalendarEntry"("customerUserId", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCalendarEntry_bookingId_ownerType_key" ON "BookingCalendarEntry"("bookingId", "ownerType");

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
