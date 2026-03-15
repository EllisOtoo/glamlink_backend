ALTER TABLE "Booking"
  ADD COLUMN "reminder24hSentAt" TIMESTAMP(3),
  ADD COLUMN "reminder2hSentAt" TIMESTAMP(3);

UPDATE "Booking"
SET "reminder24hSentAt" = "reminderSentAt"
WHERE "reminderSentAt" IS NOT NULL;

ALTER TABLE "Booking"
  DROP COLUMN "reminderSentAt";
