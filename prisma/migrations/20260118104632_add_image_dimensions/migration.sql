-- DropIndex
DROP INDEX "public"."idx_category_name_gin_trgm";

-- DropIndex
DROP INDEX "public"."idx_service_name_gin_trgm";

-- DropIndex
DROP INDEX "public"."idx_vendor_business_name_gin_trgm";

-- AlterTable
ALTER TABLE "ServiceImage" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;
