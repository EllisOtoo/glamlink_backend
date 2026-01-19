-- CreateEnum
CREATE TYPE "VendorPaymentMode" AS ENUM ('FULL_UPFRONT', 'DEPOSIT_REQUIRED');

-- CreateEnum
CREATE TYPE "PaymentIntentType" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'GIFT_CARD', 'SUPPLY_ORDER');

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "paymentType" "PaymentIntentType" NOT NULL DEFAULT 'DEPOSIT';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "defaultDepositPercent" INTEGER DEFAULT 30,
ADD COLUMN     "paymentMode" "VendorPaymentMode" NOT NULL DEFAULT 'FULL_UPFRONT';
