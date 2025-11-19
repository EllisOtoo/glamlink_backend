-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "seatId" TEXT,
ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "BookingCalendarEntry" ADD COLUMN     "seatId" TEXT,
ADD COLUMN     "staffId" TEXT;

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "avatarStorageKey" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSeat" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSeatService" (
    "serviceId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,

    CONSTRAINT "ServiceSeatService_pkey" PRIMARY KEY ("serviceId","seatId")
);

-- CreateIndex
CREATE INDEX "StaffMember_vendorId_isActive_idx" ON "StaffMember"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceSeat_vendorId_isActive_idx" ON "ServiceSeat"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceSeat_staffId_idx" ON "ServiceSeat"("staffId");

-- CreateIndex
CREATE INDEX "ServiceSeatService_seatId_idx" ON "ServiceSeatService"("seatId");

-- CreateIndex
CREATE INDEX "Booking_seatId_scheduledStart_idx" ON "Booking"("seatId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Booking_staffId_scheduledStart_idx" ON "Booking"("staffId", "scheduledStart");

-- CreateIndex
CREATE INDEX "BookingCalendarEntry_seatId_scheduledStart_idx" ON "BookingCalendarEntry"("seatId", "scheduledStart");

-- CreateIndex
CREATE INDEX "BookingCalendarEntry_staffId_scheduledStart_idx" ON "BookingCalendarEntry"("staffId", "scheduledStart");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "ServiceSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "ServiceSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCalendarEntry" ADD CONSTRAINT "BookingCalendarEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSeat" ADD CONSTRAINT "ServiceSeat_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSeat" ADD CONSTRAINT "ServiceSeat_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSeatService" ADD CONSTRAINT "ServiceSeatService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSeatService" ADD CONSTRAINT "ServiceSeatService_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "ServiceSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
