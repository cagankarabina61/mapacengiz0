-- CreateEnum
CREATE TYPE "NCRImpact" AS ENUM ('BILGILENDIRME', 'UYARI', 'BLOKAJ');

-- AlterEnum
BEGIN;
CREATE TYPE "ActivityStatus_new" AS ENUM ('PLANLANMADI', 'PLANLANDI', 'BASLANABILIR', 'IMALATA_HAZIR', 'DEVAM_EDIYOR', 'KONTROL_BEKLIYOR', 'ONAY_BEKLIYOR', 'TAMAMLANDI', 'IPTAL');
ALTER TABLE "public"."Activity" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "status" TYPE "ActivityStatus_new" USING ("status"::text::"ActivityStatus_new");
ALTER TYPE "ActivityStatus" RENAME TO "ActivityStatus_old";
ALTER TYPE "ActivityStatus_new" RENAME TO "ActivityStatus";
DROP TYPE "public"."ActivityStatus_old";
ALTER TABLE "Activity" ALTER COLUMN "status" SET DEFAULT 'PLANLANMADI';
COMMIT;

-- AlterEnum
ALTER TYPE "ConcretePourStatus" ADD VALUE 'BASLANABILIR';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "crewResourceId" TEXT,
ADD COLUMN     "equipmentResourceId" TEXT,
ADD COLUMN     "qaqcUserId" TEXT,
ADD COLUMN     "responsibleUserId" TEXT,
ADD COLUMN     "surveyUserId" TEXT;

-- AlterTable
ALTER TABLE "ActivityTemplateStep" ADD COLUMN     "requiresPileAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConcretePour" ADD COLUMN     "durationOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estimatedDurationMin" INTEGER,
ADD COLUMN     "plannedEndTime" TIMESTAMP(3),
ADD COLUMN     "qaqcUserId" TEXT,
ADD COLUMN     "responsibleUserId" TEXT,
ADD COLUMN     "surveyUserId" TEXT;

-- AlterTable
ALTER TABLE "NCR" ADD COLUMN     "impact" "NCRImpact" NOT NULL DEFAULT 'UYARI';

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "capacityM3PerHour" DECIMAL(6,2),
ADD COLUMN     "isPhysicallyExclusive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ResourceBooking" ADD COLUMN     "conflictOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conflictOverrideAt" TIMESTAMP(3),
ADD COLUMN     "conflictOverrideById" TEXT,
ADD COLUMN     "conflictOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "SegmentGateRule" (
    "id" TEXT NOT NULL,
    "structureId" TEXT,
    "requiredSteps" TEXT[],
    "requireStrength" BOOLEAN NOT NULL DEFAULT true,
    "asymmetryThreshold" INTEGER NOT NULL DEFAULT 2,
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentGateRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SegmentGateRule_structureId_key" ON "SegmentGateRule"("structureId");

-- CreateIndex
CREATE INDEX "Activity_responsibleUserId_idx" ON "Activity"("responsibleUserId");

-- CreateIndex
CREATE INDEX "Activity_crewResourceId_idx" ON "Activity"("crewResourceId");

-- CreateIndex
CREATE INDEX "ResourceBooking_activityId_idx" ON "ResourceBooking"("activityId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_qaqcUserId_fkey" FOREIGN KEY ("qaqcUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_surveyUserId_fkey" FOREIGN KEY ("surveyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_crewResourceId_fkey" FOREIGN KEY ("crewResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_equipmentResourceId_fkey" FOREIGN KEY ("equipmentResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentGateRule" ADD CONSTRAINT "SegmentGateRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_conflictOverrideById_fkey" FOREIGN KEY ("conflictOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

