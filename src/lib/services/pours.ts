// Beton dökümü servis katmanı: hazırlık kapısı + çakışma + durum yönetimi.
import { prisma } from "@/lib/db";
import { evaluatePourReadiness } from "@/lib/logic/readiness";
import { findConflicts, type ConflictWarning } from "@/lib/logic/resources";
import { pourWindow, estimatePourDuration } from "@/lib/logic/pour-planning";
import type { PourTargetType } from "@prisma/client";

/** Pour'un hedef elemanının insan-okur etiketi ("VIA-11 P5 Pile Cap"). */
export function pourTargetLabel(pour: {
  pile?: { code: string } | null;
  structureElement?: { code: string; name: string } | null;
  segment?: { code: string } | null;
}): string {
  if (pour.pile) return pour.pile.code;
  if (pour.structureElement) return `${pour.structureElement.code} ${pour.structureElement.name}`;
  if (pour.segment) return pour.segment.code;
  return "Belirtilmemiş";
}

/** Checklist durumuna göre pour'un hazır olup olmadığını değerlendirir. */
export async function getPourReadiness(pourId: string) {
  const pour = await prisma.concretePour.findUniqueOrThrow({
    where: { id: pourId },
    include: { checklistItems: { orderBy: { itemKey: "asc" } } },
  });
  return evaluatePourReadiness({
    checklistItems: pour.checklistItems.map((i) => ({
      itemKey: i.itemKey,
      label: i.label,
      isChecked: i.isChecked,
    })),
    isOverride: pour.isOverride,
    overrideReason: pour.overrideReason,
  });
}

/** Yeni pour oluşturulurken şablondan checklist kopyalar. */
export async function createChecklistForPour(
  db: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pourId: string,
  targetType: PourTargetType
) {
  const templateItems = await db.checklistTemplateItem.findMany({
    where: { appliesTo: { has: targetType } },
    orderBy: { sequenceOrder: "asc" },
  });
  await db.concretePourChecklistItem.createMany({
    data: templateItems.map((t) => ({
      pourId,
      itemKey: t.itemKey,
      label: t.label,
    })),
  });
}

/**
 * Pompa/ekip çakışmaları — seviyelendirilmiş (madde 4).
 * Kaydı engellemez; KRİTİK seviye yetkili override ile kabul edilebilir.
 * Döküm penceresi artık sabit 4 saat değil, hacim/pompa kapasitesinden hesaplanır (madde 10).
 */
export async function getPourConflicts(pour: {
  id: string;
  plannedDate: Date;
  plannedTime: string | null;
  estimatedDurationMin?: number | null;
  pumpResourceId: string | null;
  crewResourceId: string | null;
}): Promise<ConflictWarning[]> {
  const warnings: ConflictWarning[] = [];
  const interval = pourWindow(pour.plannedDate, pour.plannedTime, pour.estimatedDurationMin ?? null);

  // Bu dökümün çakışma kabulü var mı? (madde 4 — override kaynak bazında saklanır)
  const ownBookings = await prisma.resourceBooking.findMany({ where: { pourId: pour.id } });
  const overriddenResourceIds = new Set(
    ownBookings.filter((b) => b.conflictOverride).map((b) => b.resourceId)
  );

  for (const resourceId of [pour.pumpResourceId, pour.crewResourceId]) {
    if (!resourceId) continue;
    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    const [otherPours, bookings] = await Promise.all([
      prisma.concretePour.findMany({
        where: {
          id: { not: pour.id },
          status: { notIn: ["TAMAMLANDI", "IPTAL"] },
          OR: [{ pumpResourceId: resourceId }, { crewResourceId: resourceId }],
          plannedDate: {
            gte: new Date(pour.plannedDate.getTime() - 24 * 3600 * 1000),
            lte: new Date(pour.plannedDate.getTime() + 24 * 3600 * 1000),
          },
        },
        include: { pile: true, structureElement: true, segment: true, bookings: true },
      }),
      // Aktivite/segment rezervasyonları da çakışma üretir (ekip/ekipman paylaşımı).
      // Döküm-döküm çakışmaları yukarıdaki sorguyla zaten bulunuyor; aynı çakışmayı
      // ikinci kez saymamak için döküme bağlı rezervasyonlar dışarıda bırakılır.
      prisma.resourceBooking.findMany({
        where: {
          resourceId,
          pourId: null,
          startDateTime: { lt: interval.end },
          endDateTime: { gt: interval.start },
        },
        include: { activity: { include: { element: true } } },
      }),
    ]);

    const existing = [
      ...otherPours.map((o) => {
        const w = pourWindow(o.plannedDate, o.plannedTime, o.estimatedDurationMin);
        return {
          id: o.id,
          resourceId,
          startDateTime: w.start,
          endDateTime: w.end,
          targetLabel: pourTargetLabel(o),
          resourceLabel: resource ? `${resource.name} (${resource.code})` : undefined,
          isPhysicallyExclusive: resource?.isPhysicallyExclusive ?? true,
          // Karşı taraf bu kaynak için çakışmayı kabul etmişse çakışma kabul edilmiş sayılır
          conflictOverride: o.bookings.some(
            (b) => b.resourceId === resourceId && b.conflictOverride
          ),
        };
      }),
      ...bookings.map((b) => ({
        id: b.id,
        resourceId,
        startDateTime: b.startDateTime,
        endDateTime: b.endDateTime,
        targetLabel: b.activity
          ? `${b.activity.element.name} — ${b.activity.name}`
          : "Diğer rezervasyon",
        resourceLabel: resource ? `${resource.name} (${resource.code})` : undefined,
        isPhysicallyExclusive: resource?.isPhysicallyExclusive ?? true,
        conflictOverride: b.conflictOverride,
      })),
    ];

    warnings.push(
      ...findConflicts(
        {
          id: pour.id,
          resourceId,
          startDateTime: interval.start,
          endDateTime: interval.end,
          resourceLabel: resource ? `${resource.name} (${resource.code})` : undefined,
          isPhysicallyExclusive: resource?.isPhysicallyExclusive ?? true,
          conflictOverride: overriddenResourceIds.has(resourceId),
        },
        existing
      )
    );
  }
  return warnings;
}

/** Döküm penceresi — süre hesabıyla (madde 10). */
export function pourInterval(
  plannedDate: Date,
  plannedTime: string | null,
  durationMin: number | null = null
) {
  return pourWindow(plannedDate, plannedTime, durationMin);
}

/** Pompa kapasitesine göre süre hesaplar; kapasite yoksa null döner (varsayım üretmez). */
export async function computePourDuration(
  pumpResourceId: string | null,
  plannedVolumeM3: number,
  overrideMin: number | null
) {
  let capacity: number | null = null;
  if (pumpResourceId) {
    const pump = await prisma.resource.findUnique({ where: { id: pumpResourceId } });
    capacity = pump?.capacityM3PerHour ? Number(pump.capacityM3PerHour) : null;
  }
  return estimatePourDuration({
    plannedVolumeM3,
    pumpCapacityM3PerHour: capacity,
    overrideDurationMin: overrideMin,
  });
}

/** Sıradaki pour kodu: POUR-YYYY-NNNN */
export async function nextPourCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `POUR-${year}-`;
  const last = await prisma.concretePour.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}
