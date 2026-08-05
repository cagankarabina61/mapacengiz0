-- AlterTable
ALTER TABLE "BalancedCantileverSegment" ADD COLUMN     "crewResourceId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "plannedEnd" TIMESTAMP(3),
ADD COLUMN     "pumpResourceId" TEXT,
ADD COLUMN     "responsibleUserId" TEXT;

-- AlterTable
ALTER TABLE "Structure" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "hasBalancedCantilever" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StructureElement" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureElement" ADD CONSTRAINT "StructureElement_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancedCantileverSegment" ADD CONSTRAINT "BalancedCantileverSegment_pumpResourceId_fkey" FOREIGN KEY ("pumpResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancedCantileverSegment" ADD CONSTRAINT "BalancedCantileverSegment_crewResourceId_fkey" FOREIGN KEY ("crewResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalancedCantileverSegment" ADD CONSTRAINT "BalancedCantileverSegment_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

