-- AlterTable
ALTER TABLE "AvailabilityOverride" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WeeklyAvailability" ALTER COLUMN "updatedAt" DROP DEFAULT;
