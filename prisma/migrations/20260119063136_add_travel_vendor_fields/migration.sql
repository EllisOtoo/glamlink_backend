-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "customerLatitude" DOUBLE PRECISION,
ADD COLUMN     "customerLongitude" DOUBLE PRECISION,
ADD COLUMN     "travelDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "travelFeePesewas" INTEGER;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "travelFeePerKmPesewas" INTEGER,
ADD COLUMN     "travelsNationally" BOOLEAN NOT NULL DEFAULT false;
