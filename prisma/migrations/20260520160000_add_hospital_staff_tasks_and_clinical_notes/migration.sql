-- CreateEnum
CREATE TYPE "HospitalTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HospitalTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "clinicalNotes" TEXT,
ADD COLUMN "clinicalOutcome" TEXT,
ADD COLUMN "followUpInstructions" TEXT;

-- CreateTable
CREATE TABLE "HospitalTask" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "HospitalTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HospitalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalTask_hospitalId_status_idx" ON "HospitalTask"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "HospitalTask_assignedToUserId_status_idx" ON "HospitalTask"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "HospitalTask_hospitalId_dueAt_idx" ON "HospitalTask"("hospitalId", "dueAt");

-- AddForeignKey
ALTER TABLE "HospitalTask" ADD CONSTRAINT "HospitalTask_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalTask" ADD CONSTRAINT "HospitalTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalTask" ADD CONSTRAINT "HospitalTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
