-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "includes" TEXT[] DEFAULT ARRAY[]::TEXT[];
