-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('ACIK', 'COZULDU');

-- CreateEnum
CREATE TYPE "AttentionLevel" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK');

-- CreateEnum
CREATE TYPE "AttentionItemStatus" AS ENUM ('ACIK', 'COZULDU');

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "anchorKey" TEXT,
    "body" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'ACIK',
    "isEditReason" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAttentionItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "reasons" TEXT[],
    "nextActions" TEXT[],
    "level" "AttentionLevel" NOT NULL DEFAULT 'ORTA',
    "structureCode" TEXT,
    "responsible" TEXT,
    "linkHref" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" "AttentionItemStatus" NOT NULL DEFAULT 'ACIK',
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAttentionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_entityType_entityId_status_idx" ON "Note"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "UserAttentionItem_status_validUntil_idx" ON "UserAttentionItem"("status", "validUntil");

-- CreateIndex
CREATE INDEX "UserAttentionItem_createdById_idx" ON "UserAttentionItem"("createdById");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAttentionItem" ADD CONSTRAINT "UserAttentionItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAttentionItem" ADD CONSTRAINT "UserAttentionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
