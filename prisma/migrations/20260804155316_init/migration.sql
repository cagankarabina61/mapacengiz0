-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('YONETICI', 'TEKNIK_OFIS', 'SAHA_MUHENDISI', 'QAQC', 'SURVEY', 'IZLEYICI');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('VIYADUK', 'KOPRU', 'ALT_GECIT', 'UST_GECIT', 'MENFEZ', 'DIGER');

-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('ABUTMENT', 'PIER', 'PILE_CAP', 'PIER_GOVDESI', 'BASLIK', 'BEARING', 'DIGER');

-- CreateEnum
CREATE TYPE "ElementStatus" AS ENUM ('PLANLANMADI', 'PLANLANDI', 'BASLANMADI', 'DEVAM_EDIYOR', 'KONTROL_BEKLIYOR', 'ONAY_BEKLIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANLANMADI', 'PLANLANDI', 'BASLANMADI', 'DEVAM_EDIYOR', 'KONTROL_BEKLIYOR', 'ONAY_BEKLIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START');

-- CreateEnum
CREATE TYPE "PileStatus" AS ENUM ('PLANLANDI', 'DELGI_BEKLIYOR', 'DELGI_DEVAM_EDIYOR', 'DELGI_TAMAMLANDI', 'DONATI_KAFESI_HAZIRLANIYOR', 'DONATI_KAFESI_HAZIR', 'BETON_BEKLIYOR', 'BETONLANDI', 'TEST_BEKLIYOR', 'TEST_YAPILDI', 'KABUL_EDILDI', 'PROBLEMLI');

-- CreateEnum
CREATE TYPE "PileTestStatus" AS ENUM ('BEKLIYOR', 'YAPILDI');

-- CreateEnum
CREATE TYPE "PileAcceptanceStatus" AS ENUM ('BEKLIYOR', 'KABUL', 'RED');

-- CreateEnum
CREATE TYPE "PourTargetType" AS ENUM ('PILE', 'STRUCTURE_ELEMENT', 'SEGMENT');

-- CreateEnum
CREATE TYPE "ConcretePourStatus" AS ENUM ('PLANLANDI', 'HAZIR_DEGIL', 'BETON_DOKUMUNE_HAZIR', 'BETON_DOKULUYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('BEKLIYOR', 'TAMAMLANDI');

-- CreateEnum
CREATE TYPE "TestSampleType" AS ENUM ('KUP', 'SILINDIR');

-- CreateEnum
CREATE TYPE "TestResultStatus" AS ENUM ('BEKLIYOR', 'GECTI', 'KALDI');

-- CreateEnum
CREATE TYPE "SegmentSide" AS ENUM ('SOL', 'SAG', 'TEK');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('BEKLIYOR', 'DEVAM_EDIYOR', 'TAMAMLANDI');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('PLANLANMADI', 'PLANLANDI', 'BASLANABILIR', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('POMPA', 'VINC', 'KALIP_EKIBI', 'DONATI_EKIBI', 'BETON_EKIBI', 'SURVEY_EKIBI', 'QAQC_EKIBI', 'DIGER');

-- CreateEnum
CREATE TYPE "BookingTargetType" AS ENUM ('CONCRETE_POUR', 'ACTIVITY', 'SEGMENT');

-- CreateEnum
CREATE TYPE "DrawingType" AS ENUM ('IFC', 'SHOP_DRAWING', 'DIGER');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('TASLAK', 'INCELEMEDE', 'ONAYLI', 'REDDEDILDI', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RFIStatus" AS ENUM ('TASLAK', 'GONDERILDI', 'CEVAP_BEKLENIYOR', 'CEVAPLANDI', 'KAPATILDI');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK');

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('HOLD_POINT', 'WITNESS_POINT', 'REVIEW', 'INSPECTION');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('BEKLIYOR', 'GECTI', 'KALDI', 'SARTLI_GECTI');

-- CreateEnum
CREATE TYPE "NCRStatus" AS ENUM ('ACIK', 'DUZELTME_YAPILIYOR', 'KAPATILDI');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ACIK', 'COZULDU');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('FOTOGRAF', 'PDF', 'EXCEL', 'DIGER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "client" TEXT,
    "startDate" TIMESTAMP(3),
    "isSample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StructureType" NOT NULL,
    "startChainage" TEXT,
    "endChainage" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureElement" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "elementType" "ElementType" NOT NULL,
    "sequenceIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "ElementStatus" NOT NULL DEFAULT 'PLANLANMADI',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "StructureElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANLANMADI',
    "sequenceIndex" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "responsibleRole" "RoleName",
    "notes" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "predecessorActivityId" TEXT NOT NULL,
    "successorActivityId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" TEXT NOT NULL,
    "elementType" "ElementType" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,

    CONSTRAINT "ActivityTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PileGroup" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designPileCount" INTEGER NOT NULL,

    CONSTRAINT "PileGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pile" (
    "id" TEXT NOT NULL,
    "pileGroupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locationNote" TEXT,
    "diameterMm" INTEGER,
    "designLengthM" DECIMAL(8,2),
    "actualLengthM" DECIMAL(8,2),
    "drillStart" TIMESTAMP(3),
    "drillEnd" TIMESTAMP(3),
    "status" "PileStatus" NOT NULL DEFAULT 'PLANLANDI',
    "rebarCageStatus" TEXT,
    "concreteClass" TEXT,
    "plannedConcreteVolumeM3" DECIMAL(10,2),
    "actualConcreteVolumeM3" DECIMAL(10,2),
    "concreteDate" TIMESTAMP(3),
    "testStatus" "PileTestStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "testResult" TEXT,
    "acceptanceStatus" "PileAcceptanceStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "problemDescription" TEXT,

    CONSTRAINT "Pile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcretePour" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetType" "PourTargetType" NOT NULL,
    "pileId" TEXT,
    "structureElementId" TEXT,
    "segmentId" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "plannedTime" TEXT,
    "concreteClass" TEXT,
    "plannedVolumeM3" DECIMAL(10,2) NOT NULL,
    "actualVolumeM3" DECIMAL(10,2),
    "batchPlantName" TEXT,
    "pumpResourceId" TEXT,
    "crewResourceId" TEXT,
    "pourStart" TIMESTAMP(3),
    "pourEnd" TIMESTAMP(3),
    "qaqcStatus" "CheckStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "surveyStatus" "CheckStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "itpStatus" "CheckStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "status" "ConcretePourStatus" NOT NULL DEFAULT 'PLANLANDI',
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideById" TEXT,
    "overrideAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcretePour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "appliesTo" "PourTargetType"[],
    "sequenceOrder" INTEGER NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcretePourChecklistItem" (
    "id" TEXT NOT NULL,
    "pourId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "ConcretePourChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteTestSample" (
    "id" TEXT NOT NULL,
    "pourId" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "castDate" TIMESTAMP(3) NOT NULL,
    "testType" "TestSampleType" NOT NULL,
    "ageDays" INTEGER NOT NULL,
    "testDate" TIMESTAMP(3),
    "resultMPa" DECIMAL(6,2),
    "resultStatus" "TestResultStatus" NOT NULL DEFAULT 'BEKLIYOR',

    CONSTRAINT "ConcreteTestSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalancedCantileverSegment" (
    "id" TEXT NOT NULL,
    "pierElementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "segmentNumber" INTEGER NOT NULL,
    "side" "SegmentSide" NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "rebarStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "formworkStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "tendonStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "anchorageStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "embeddedItemsStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "inspectionStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "concreteStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "requiredConcreteStrengthMPa" DECIMAL(6,2),
    "achievedConcreteStrengthMPa" DECIMAL(6,2),
    "postTensioningStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "surveyStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "groutingStatus" "StepStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "status" "SegmentStatus" NOT NULL DEFAULT 'PLANLANMADI',

    CONSTRAINT "BalancedCantileverSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceBooking" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "targetType" "BookingTargetType" NOT NULL,
    "pourId" TEXT,
    "activityId" TEXT,
    "segmentId" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "elementId" TEXT,
    "drawingType" "DrawingType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingRevision" (
    "id" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "revisionCode" TEXT NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'TASLAK',
    "approvedDate" TIMESTAMP(3),
    "attachmentId" TEXT,

    CONSTRAINT "DrawingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementDrawingUsage" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "siteUsedRevisionId" TEXT NOT NULL,

    CONSTRAINT "ElementDrawingUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFI" (
    "id" TEXT NOT NULL,
    "rfiNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "structureId" TEXT NOT NULL,
    "elementId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'ORTA',
    "responsibleUserId" TEXT,
    "submittedDate" TIMESTAMP(3),
    "answeredDate" TIMESTAMP(3),
    "status" "RFIStatus" NOT NULL DEFAULT 'TASLAK',

    CONSTRAINT "RFI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFIAffectedActivity" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "RFIAffectedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITPTemplate" (
    "id" TEXT NOT NULL,
    "elementType" "ElementType" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ITPTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITPCheckpoint" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "checkpointType" "CheckpointType" NOT NULL,

    CONSTRAINT "ITPCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "activityId" TEXT,
    "result" "InspectionResult" NOT NULL DEFAULT 'BEKLIYOR',
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCR" (
    "id" TEXT NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "elementId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "correctiveAction" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "NCRStatus" NOT NULL DEFAULT 'ACIK',
    "closedDate" TIMESTAMP(3),

    CONSTRAINT "NCR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'ORTA',
    "status" "IssueStatus" NOT NULL DEFAULT 'ACIK',
    "reportedById" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionNotes" TEXT,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_resource_action_key" ON "RolePermission"("role", "resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Structure_code_key" ON "Structure"("code");

-- CreateIndex
CREATE INDEX "Structure_projectId_idx" ON "Structure"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StructureElement_code_key" ON "StructureElement"("code");

-- CreateIndex
CREATE INDEX "StructureElement_structureId_idx" ON "StructureElement"("structureId");

-- CreateIndex
CREATE INDEX "StructureElement_parentId_idx" ON "StructureElement"("parentId");

-- CreateIndex
CREATE INDEX "StructureElement_status_idx" ON "StructureElement"("status");

-- CreateIndex
CREATE INDEX "Activity_elementId_idx" ON "Activity"("elementId");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_plannedStart_idx" ON "Activity"("plannedStart");

-- CreateIndex
CREATE INDEX "Activity_plannedEnd_idx" ON "Activity"("plannedEnd");

-- CreateIndex
CREATE INDEX "Dependency_successorActivityId_idx" ON "Dependency"("successorActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_predecessorActivityId_successorActivityId_key" ON "Dependency"("predecessorActivityId", "successorActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_elementType_key" ON "ActivityTemplate"("elementType");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplateStep_templateId_sequenceOrder_key" ON "ActivityTemplateStep"("templateId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "PileGroup_elementId_idx" ON "PileGroup"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Pile_code_key" ON "Pile"("code");

-- CreateIndex
CREATE INDEX "Pile_pileGroupId_idx" ON "Pile"("pileGroupId");

-- CreateIndex
CREATE INDEX "Pile_status_idx" ON "Pile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConcretePour_code_key" ON "ConcretePour"("code");

-- CreateIndex
CREATE INDEX "ConcretePour_plannedDate_idx" ON "ConcretePour"("plannedDate");

-- CreateIndex
CREATE INDEX "ConcretePour_status_idx" ON "ConcretePour"("status");

-- CreateIndex
CREATE INDEX "ConcretePour_pileId_idx" ON "ConcretePour"("pileId");

-- CreateIndex
CREATE INDEX "ConcretePour_structureElementId_idx" ON "ConcretePour"("structureElementId");

-- CreateIndex
CREATE INDEX "ConcretePour_segmentId_idx" ON "ConcretePour"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_itemKey_key" ON "ChecklistTemplateItem"("itemKey");

-- CreateIndex
CREATE INDEX "ConcretePourChecklistItem_pourId_idx" ON "ConcretePourChecklistItem"("pourId");

-- CreateIndex
CREATE UNIQUE INDEX "ConcretePourChecklistItem_pourId_itemKey_key" ON "ConcretePourChecklistItem"("pourId", "itemKey");

-- CreateIndex
CREATE INDEX "ConcreteTestSample_pourId_idx" ON "ConcreteTestSample"("pourId");

-- CreateIndex
CREATE UNIQUE INDEX "BalancedCantileverSegment_code_key" ON "BalancedCantileverSegment"("code");

-- CreateIndex
CREATE INDEX "BalancedCantileverSegment_pierElementId_idx" ON "BalancedCantileverSegment"("pierElementId");

-- CreateIndex
CREATE UNIQUE INDEX "BalancedCantileverSegment_pierElementId_side_segmentNumber_key" ON "BalancedCantileverSegment"("pierElementId", "side", "segmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_code_key" ON "Resource"("code");

-- CreateIndex
CREATE INDEX "ResourceBooking_resourceId_startDateTime_idx" ON "ResourceBooking"("resourceId", "startDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Drawing_code_key" ON "Drawing"("code");

-- CreateIndex
CREATE INDEX "Drawing_structureId_idx" ON "Drawing"("structureId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingRevision_drawingId_revisionCode_key" ON "DrawingRevision"("drawingId", "revisionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ElementDrawingUsage_elementId_drawingId_key" ON "ElementDrawingUsage"("elementId", "drawingId");

-- CreateIndex
CREATE UNIQUE INDEX "RFI_rfiNumber_key" ON "RFI"("rfiNumber");

-- CreateIndex
CREATE INDEX "RFI_structureId_idx" ON "RFI"("structureId");

-- CreateIndex
CREATE INDEX "RFI_status_idx" ON "RFI"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RFIAffectedActivity_rfiId_activityId_key" ON "RFIAffectedActivity"("rfiId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ITPTemplate_elementType_key" ON "ITPTemplate"("elementType");

-- CreateIndex
CREATE UNIQUE INDEX "ITPCheckpoint_templateId_sequenceOrder_key" ON "ITPCheckpoint"("templateId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "Inspection_elementId_idx" ON "Inspection"("elementId");

-- CreateIndex
CREATE INDEX "Inspection_result_idx" ON "Inspection"("result");

-- CreateIndex
CREATE UNIQUE INDEX "NCR_ncrNumber_key" ON "NCR"("ncrNumber");

-- CreateIndex
CREATE INDEX "NCR_structureId_idx" ON "NCR"("structureId");

-- CreateIndex
CREATE INDEX "NCR_status_idx" ON "NCR"("status");

-- CreateIndex
CREATE INDEX "Issue_entityType_entityId_idx" ON "Issue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_changedAt_idx" ON "AuditLog"("changedAt");

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureElement" ADD CONSTRAINT "StructureElement_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureElement" ADD CONSTRAINT "StructureElement_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StructureElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_predecessorActivityId_fkey" FOREIGN KEY ("predecessorActivityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_successorActivityId_fkey" FOREIGN KEY ("successorActivityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplateStep" ADD CONSTRAINT "ActivityTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ActivityTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PileGroup" ADD CONSTRAINT "PileGroup_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pile" ADD CONSTRAINT "Pile_pileGroupId_fkey" FOREIGN KEY ("pileGroupId") REFERENCES "PileGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_pileId_fkey" FOREIGN KEY ("pileId") REFERENCES "Pile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_structureElementId_fkey" FOREIGN KEY ("structureElementId") REFERENCES "StructureElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "BalancedCantileverSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_pumpResourceId_fkey" FOREIGN KEY ("pumpResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_crewResourceId_fkey" FOREIGN KEY ("crewResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePour" ADD CONSTRAINT "ConcretePour_overrideById_fkey" FOREIGN KEY ("overrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePourChecklistItem" ADD CONSTRAINT "ConcretePourChecklistItem_pourId_fkey" FOREIGN KEY ("pourId") REFERENCES "ConcretePour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcretePourChecklistItem" ADD CONSTRAINT "ConcretePourChecklistItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteTestSample" ADD CONSTRAINT "ConcreteTestSample_pourId_fkey" FOREIGN KEY ("pourId") REFERENCES "ConcretePour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancedCantileverSegment" ADD CONSTRAINT "BalancedCantileverSegment_pierElementId_fkey" FOREIGN KEY ("pierElementId") REFERENCES "StructureElement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_pourId_fkey" FOREIGN KEY ("pourId") REFERENCES "ConcretePour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "BalancedCantileverSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingRevision" ADD CONSTRAINT "DrawingRevision_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementDrawingUsage" ADD CONSTRAINT "ElementDrawingUsage_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementDrawingUsage" ADD CONSTRAINT "ElementDrawingUsage_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementDrawingUsage" ADD CONSTRAINT "ElementDrawingUsage_siteUsedRevisionId_fkey" FOREIGN KEY ("siteUsedRevisionId") REFERENCES "DrawingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIAffectedActivity" ADD CONSTRAINT "RFIAffectedActivity_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "RFI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIAffectedActivity" ADD CONSTRAINT "RFIAffectedActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITPCheckpoint" ADD CONSTRAINT "ITPCheckpoint_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ITPTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "ITPCheckpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StructureElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
