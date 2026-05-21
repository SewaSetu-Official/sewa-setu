-- Allow multiple generated appointment times inside one recurring availability window.
DROP INDEX IF EXISTS "Booking_availabilitySlotId_scheduledAt_key";
DROP INDEX IF EXISTS "unique_slot_occurrence";

CREATE UNIQUE INDEX "Booking_availabilitySlotId_scheduledAt_slotTime_key"
ON "Booking"("availabilitySlotId", "scheduledAt", "slotTime");
