/*
  Warnings:

  - You are about to drop the column `bookingId` on the `Review` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "HospitalRole" AS ENUM ('HOSPITAL_OWNER', 'HOSPITAL_MANAGER', 'RECEPTION', 'CONTENT_EDITOR');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PLATFORM_ADMIN';

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_bookingId_fkey";

-- DropIndex
DROP INDEX "Review_bookingId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "disability" TEXT;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "bookingId",
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HospitalMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "role" "HospitalRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalMembership_hospitalId_status_idx" ON "HospitalMembership"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "HospitalMembership_userId_idx" ON "HospitalMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalMembership_userId_hospitalId_key" ON "HospitalMembership"("userId", "hospitalId");

-- CreateIndex
CREATE INDEX "AuditLog_hospitalId_idx" ON "AuditLog"("hospitalId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_status_scheduledAt_idx" ON "Booking"("hospitalId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Hospital_isActive_verified_idx" ON "Hospital"("isActive", "verified");

-- CreateIndex
CREATE INDEX "Review_hidden_idx" ON "Review"("hidden");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "HospitalMembership" ADD CONSTRAINT "HospitalMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalMembership" ADD CONSTRAINT "HospitalMembership_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
