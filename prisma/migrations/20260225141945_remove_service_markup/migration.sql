/*
  Warnings:

  - The values [SERVICE_MARKUP_BPS] on the enum `PlatformSettingKey` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlatformSettingKey_new" AS ENUM ('PLATFORM_FEE_PERCENT');
ALTER TABLE "PlatformSetting" ALTER COLUMN "key" TYPE "PlatformSettingKey_new" USING ("key"::text::"PlatformSettingKey_new");
ALTER TYPE "PlatformSettingKey" RENAME TO "PlatformSettingKey_old";
ALTER TYPE "PlatformSettingKey_new" RENAME TO "PlatformSettingKey";
DROP TYPE "public"."PlatformSettingKey_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."Service_searchEmbedding_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "platformFeePesewas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorPayoutPesewas" INTEGER NOT NULL DEFAULT 0;
