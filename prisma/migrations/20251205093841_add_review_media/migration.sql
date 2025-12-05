-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "mediaStorageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
