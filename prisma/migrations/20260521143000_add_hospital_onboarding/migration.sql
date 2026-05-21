-- CreateEnum
CREATE TYPE "HospitalOnboardingStatus" AS ENUM (
  'NEW',
  'MEETING_DONE',
  'DATA_REQUESTED',
  'DATA_RECEIVED',
  'DATA_ENTRY_IN_PROGRESS',
  'WAITING_FOR_HOSPITAL_CONFIRMATION',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'NEEDS_UPDATE',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "HospitalOnboardingFileType" AS ENUM (
  'DOCTOR_LIST',
  'DEPARTMENT_LIST',
  'SCHEDULE_LIST',
  'PACKAGE_LIST',
  'HOSPITAL_PROFILE',
  'LOGO',
  'PHOTOS',
  'LICENSE_DOCUMENT',
  'BROCHURE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "HospitalImportType" AS ENUM (
  'DEPARTMENTS',
  'DOCTORS',
  'SCHEDULES',
  'PACKAGES',
  'MEDIA',
  'MIXED'
);

-- CreateEnum
CREATE TYPE "HospitalImportStatus" AS ENUM (
  'UPLOADED',
  'PARSING',
  'VALIDATING',
  'HAS_ERRORS',
  'READY_TO_IMPORT',
  'IMPORTED',
  'CANCELLED'
);

-- AlterTable
ALTER TABLE "Hospital"
ADD COLUMN "onboardingStatus" "HospitalOnboardingStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT;

-- AlterTable
ALTER TABLE "Doctor"
ADD COLUMN "dataOrigin" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "DoctorService"
ADD COLUMN "dataOrigin" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "AvailabilitySlot"
ADD COLUMN "dataOrigin" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "DoctorMedia"
ADD COLUMN "dataOrigin" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceHash" TEXT;

-- AlterTable
ALTER TABLE "HospitalMedia"
ADD COLUMN "dataOrigin" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceHash" TEXT;

-- CreateTable
CREATE TABLE "HospitalOnboarding" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "partnerInquiryId" TEXT,
    "status" "HospitalOnboardingStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "meetingNotes" TEXT,
    "internalNotes" TEXT,
    "dataReceivedAt" TIMESTAMP(3),
    "dataEntryStartedAt" TIMESTAMP(3),
    "readyToPublishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "confirmedByHospitalAt" TIMESTAMP(3),
    "hospitalConfirmationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalOnboardingFile" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "type" "HospitalOnboardingFileType" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalOnboardingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalOnboardingNote" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalOnboardingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalOnboardingChecklistItem" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalOnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalImportBatch" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "type" "HospitalImportType" NOT NULL,
    "status" "HospitalImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFileName" TEXT,
    "fileUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "errors" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "importedEntity" TEXT,
    "importedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalOnboarding_hospitalId_key" ON "HospitalOnboarding"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalOnboarding_partnerInquiryId_key" ON "HospitalOnboarding"("partnerInquiryId");

-- CreateIndex
CREATE INDEX "HospitalOnboarding_status_idx" ON "HospitalOnboarding"("status");

-- CreateIndex
CREATE INDEX "HospitalOnboarding_assignedToUserId_status_idx" ON "HospitalOnboarding"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "HospitalOnboarding_hospitalId_idx" ON "HospitalOnboarding"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalOnboarding_partnerInquiryId_idx" ON "HospitalOnboarding"("partnerInquiryId");

-- CreateIndex
CREATE INDEX "HospitalOnboardingFile_onboardingId_idx" ON "HospitalOnboardingFile"("onboardingId");

-- CreateIndex
CREATE INDEX "HospitalOnboardingFile_type_idx" ON "HospitalOnboardingFile"("type");

-- CreateIndex
CREATE INDEX "HospitalOnboardingNote_onboardingId_idx" ON "HospitalOnboardingNote"("onboardingId");

-- CreateIndex
CREATE INDEX "HospitalOnboardingNote_authorUserId_idx" ON "HospitalOnboardingNote"("authorUserId");

-- CreateIndex
CREATE INDEX "HospitalOnboardingChecklistItem_onboardingId_isCompleted_idx" ON "HospitalOnboardingChecklistItem"("onboardingId", "isCompleted");

-- CreateIndex
CREATE INDEX "HospitalImportBatch_onboardingId_idx" ON "HospitalImportBatch"("onboardingId");

-- CreateIndex
CREATE INDEX "HospitalImportBatch_hospitalId_idx" ON "HospitalImportBatch"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalImportBatch_status_idx" ON "HospitalImportBatch"("status");

-- CreateIndex
CREATE INDEX "HospitalImportRow_batchId_idx" ON "HospitalImportRow"("batchId");

-- CreateIndex
CREATE INDEX "HospitalImportRow_isValid_idx" ON "HospitalImportRow"("isValid");

-- AddForeignKey
ALTER TABLE "HospitalOnboarding" ADD CONSTRAINT "HospitalOnboarding_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboarding" ADD CONSTRAINT "HospitalOnboarding_partnerInquiryId_fkey" FOREIGN KEY ("partnerInquiryId") REFERENCES "PartnerInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboarding" ADD CONSTRAINT "HospitalOnboarding_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboarding" ADD CONSTRAINT "HospitalOnboarding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingFile" ADD CONSTRAINT "HospitalOnboardingFile_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "HospitalOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingFile" ADD CONSTRAINT "HospitalOnboardingFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingNote" ADD CONSTRAINT "HospitalOnboardingNote_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "HospitalOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingNote" ADD CONSTRAINT "HospitalOnboardingNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingChecklistItem" ADD CONSTRAINT "HospitalOnboardingChecklistItem_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "HospitalOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOnboardingChecklistItem" ADD CONSTRAINT "HospitalOnboardingChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalImportBatch" ADD CONSTRAINT "HospitalImportBatch_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "HospitalOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalImportBatch" ADD CONSTRAINT "HospitalImportBatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalImportBatch" ADD CONSTRAINT "HospitalImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalImportRow" ADD CONSTRAINT "HospitalImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HospitalImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
